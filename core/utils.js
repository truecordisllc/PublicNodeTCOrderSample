const fs = require('fs');
const settings = require('../settings');

// The following function is used to display a console.log and/or 
// write to a file in a 'log' folder one level higher than the default folder
exports.writeLog = (function (lConsoleLog, lFileLog, cMessage) {
    var date = new Date();

    // create a date time string yyyy-mm-dd hh:mm:ss format
    var dateString = date.getUTCFullYear() + "-" +
        ("0" + (date.getUTCMonth()+1)).slice(-2) + "-" +
        ("0" + date.getUTCDate()).slice(-2);

    var dateTimeString = dateString + " " +
        ("0" + date.getHours()).slice(-2) + ":" +
        ("0" + date.getMinutes()).slice(-2) + ":" +
        ("0" + date.getSeconds()).slice(-2);

    //console.log('SERVER UTILS WriteLog',dateTimeString)

     //console.log(dateString);
    if (lConsoleLog) {
        console.log('  Logging to console: ' +dateTimeString+': '+cMessage)
    };

    if (lFileLog) {
        let cPath = 'log'
        //console.log('path   ..\\log path exists? '+fs.existsSync(cPath))
        if(!fs.existsSync(cPath)) {
            console.log('  Folder does not exist so create it!!!')
            fs.mkdirSync(cPath);
        }

        //let cFileName = 'log.txt'
        let cFileName = settings.appConfig.nameShort+'-'+dateString+'.txt'
        let cPathAndFileName = cPath+'/'+cFileName

        // This function seems to create a file if not there but if there append!
        // we apparently do not need to detect if it exists or not!
        fs.appendFileSync(cPathAndFileName, '\r\n' +dateTimeString+': '+cMessage);
        return 

    }
});
/*
exports.writeLog(true,true,'This is a message 1');
exports.writeLog(true,true,'This is a message 2');
exports.writeLog(true,true,'This is a message 3');
exports.writeLog(true,true,'This is a message 4');
exports.writeLog(true,true,'This is a message 5');
*/

