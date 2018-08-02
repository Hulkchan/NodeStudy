const fs = require('fs')
const path = require('path')
// const config = require('../config/defaultConfig')
const promisify = require('util').promisify
const Handlebars = require('handlebars')
const stat = promisify(fs.stat)
const readdir = promisify(fs.readdir)

const tplPath = path.join(__dirname, '../template/dir.tpl')
const source = fs.readFileSync(tplPath, 'utf-8')
const template = Handlebars.compile(source)

const mime = require('./mine')
const compress = require('./compress')

const range = require('./range')
const isFresh = require('../helper/cache')

module.exports = async function(req, res, filePath, config) {
    try {
        const stats = await stat(filePath)
        if (stats.isFile()) {
            const contentType = mime(filePath)
            
            res.setHeader('Content-Type', contentType)
            if(isFresh(stats, req, res)) {
                res.statusCode = 304
                res.end()
                return
            }

            let rs
            const { code, start, end } = range(stats.size, req, res)
            if(code === 200) {
                rs = fs.createReadStream(filePath)
                res.statusCode = 200
            }else{
                rs = fs.createReadStream(filePath, {start, end})
                res.statusCode = 206
            }
            if (filePath.match(config.compress)) {
                rs = compress(rs, req, res)
            }
            rs.pipe(res)
        } else if (stats.isDirectory()) {
            const files = await readdir(filePath)
            res.statusCode = 200
            res.setHeader('Content-Type', 'text/html')
            const dir = path.relative(config.root, filePath)
            const data = {
                files: files.map(file => {
                    return {
                        file,
                        icon: mime(file)
                    }
                }) ,
                title: path.basename(filePath),
                dir: dir ? `/${dir}` : ''
            }
            res.end(template(data))
        }
    } catch (error) {
        console.log(error)
        res.statusCode = 404
        res.setHeader('Content-Type', 'text/plain')
        res.end(`404 is not found`)
    } 
}