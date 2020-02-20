var express = require("express")
var app = express()
const bodyParser = require('body-parser');
const server = require('http').createServer(app);
const fs = require('file-system');
const fetch = require('popsicle')
const getUrls = require('get-urls');
const nodemailer = require('nodemailer');
const mongodb = require('mongodb');
const axios = require('axios')
const MongoClient = require('mongodb').MongoClient;
var requestCounter = 0;
var url = require('url');
const fileInfo = require('file-info');
var zipFolder = require('zip-folder');
const path = require("path");
app.use(bodyParser.json());
app.use(express.static('public'));
const db_host = process.env.DB_HOST;
const db_name = process.env.DB_NAME;
var transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: 'jhonedisonrod21@gmail.com',
        pass: 'tgyjfrulowzluxni'
    }
});

var db;
MongoClient.connect('mongodb://' + db_host + '/' + db_name, (err, database) => {//-----------conexion a la base de datos-------
    if (err) {
        console.log('MongoDB Connection Error. Please make sure that MongoDB is running.');
        process.exit(1);
    }
    db = database;
    console.log("conected with the db   :V")
});


app.get('/', (req, res) => {
    res.json({ info: 'Su servidor Espress esta en linea' })
});

app.get('/records', async (req, res) => {
    var array = [];
    let records = await db.collection('records');
    array2 = await records.find({}).toArray();    
    res.status(200).json(array2);
});


async function sendmail(mail, body, filePath,zipname) {
    var mailOptions = {
        from: 'File Loader',
        to: mail,
        subject: 'File loader notification',
        text: body + "\n puede descargar el archivo zip en la siguiente direccion:  http://172.22.0.1:3001/"+zipname,
        attachments: [
            {
                filename: 'report.pdf',
                path: filePath
            }
        ]
    };
    transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
            console.log(error);
            res.send(500, err.message);
        } else {
            console.log("Email sent");
            res.status(200).jsonp(req.body);
        }
    });
}

async function generatePdf(dir) {
    var paths = []
    var info = []
    await fileInfo.showList(dir).then((data) => {
        for (let i = 1; i < data.length; i++) {
            paths.push("" + data[i]);
        }
    });
    var fs = require('fs');
    paths.forEach(link => {
        var path = require('path');
        var filename = path.basename(link);
        var size = (fs.statSync(link).size) / 1000000.0
        var data = { name: filename, size: size + ' Bytes' }
        info.push(data)
    });
    //---------------generando el pdf------------------

    var pdf = require('html-pdf');
    var tabla = `
        <tr>
            <th style="border: blue 2px solid" >Archivo</th>
            <th style="border: blue 2px solid">Tamaño (bytes)</th> 
        </tr>
        `;
    info.forEach(element => {
        tabla = tabla + `
        <tr>
            <td style="border: blue 2px solid">${element.name}</td>    
            <td style="border: blue 2px solid">${element.size}</td>  
        </tr>        
        `
    });
    const content = `
    <!doctype html>
    <html>
       <head>
            <meta charset="utf-8">
            <title>PDF Result Template</title>
        </head>
        <body style="padding: 40px;">            
            <h1 >Reporte de archivos</h1>
            <table>
                ${tabla}
            </table>          
        </body>
    </html>
    `;
    pdf.create(content).toFile(dir + '/report.pdf', function (err, res) {
        if (err) return console.log(err);
    });
}

async function zip(dir, name) {
    zipFolder(dir, __dirname + '/public/' + name + ".zip", function (err) {
        if (err) {
            console.log('oh no!', err);
        } else {
            console.log('carpeta comprimida con exito');
        }
    });
}

async function downloadAndCompress(links) {
    const path = __dirname + '/uploads/request#' + requestCounter
    fs.mkdir(path);
    for (const link of links) {
        var type = await dataTipe(link, path)  //---------sdfsdfsdf
    }
}
async function getHtmlofLink(req, res, cb) {
    const result = await fetch.fetch(req.body.link);
    res.sendStatus(200)
    const data = await result.text();
    return data
}
// ---  // borrar todo con la carpeta en cascada
async function dataTipe(link, path) {
    var value = ""
    try {
        var valueres = await axios.get(link)
            .then(response => {////--------------------------------evaluar y guardarlos en el path---------------------------------
                value = response.headers["content-type"]
                if (value != null && value != "" && value != "" && value != "") {
                    try {
                        var file_name = url.parse(link).pathname.split('/').pop();
                        if (file_name != "/" && file_name != "") {
                            var file = fs.createWriteStream(path + "/" + file_name);
                            file.write(response.data)
                            file.end();
                        }
                    } catch (error) { }
                }
            })
    } catch (error) { }
    return value
}

async function saveRecord(data) {
    let records = db.collection('records');
    records.insertOne({ mail: data.mail, filesInfo: data.info }, function (err, result) {
        console.log("saveds 1 record in the colection");
    });
}

app.post('/link', async (req, res, cb) => {
    console.log("prosesing request")
    requestCounter = requestCounter + 1;
    var data = await getHtmlofLink(req, res, cb)
    var links = getUrls(data);
    var result = []    
    links.forEach(link => {
        result.push(`${link}`.slice(0, `${link}`.length))
    });
    res.status(200)
    gpath = __dirname + '/uploads/request#' + requestCounter
    await downloadAndCompress(result, req.body.mail)
    await zip(gpath, 'request#' + requestCounter)
    await generatePdf(gpath)
    var mailbody = "acontinuacion se anexa un reporte con los archivos recuperados del sitio web que envio"
    await sendmail(req.body.mail, mailbody,gpath + "/report.pdf",'request#' + requestCounter+'.zip')
    let recordData ={mail:req.body.mail,info:result}
    await saveRecord(recordData)
});

async function clean(gpath) {
    console.log("eliminando archivos incecesarios")
    fs.rmdirSync(gpath)
}

app.post('/file', async (req, res) => {
    console.log("prosesing request")
    requestCounter = requestCounter + 1;
    var BNHN = req.body.file
    var links = getUrls(BNHN)
    var result = []    
    links.forEach(link => {
        result.push(`${link}`.slice(0, `${link}`.length)) ///----------------Urls sacadas del archivo
    });
    res.status(200)
    gpath = __dirname + '/uploads/request#' + requestCounter
    await downloadAndCompress(result, req.body.mail)
    await zip(gpath, 'request#' + requestCounter)
    await generatePdf(gpath)
    var mailbody = "acontinuacion se anexa un reporte con los archivos recuperados del sitio web que envio"
    await sendmail(req.body.mail, mailbody, gpath + "/report.pdf",'request#' + requestCounter+'.zip')
    let data ={mail:req.body.mail,info:result}
    await saveRecord(data)
})

server.listen('3000', function () {
    console.log("app listening in the port 3000")
})
