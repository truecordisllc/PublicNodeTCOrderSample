// Primary database connection
const sqlDb = require('mssql');
// Confirm response database connection
const sqlDbConfirm = require('mssql');

const settings = require('../settings');
const confignode = require('../confignode');

// access the writeLog function
const utils = require('./utils');


// Note that this primary key when set by the runGetOrder backend process, 
// will be used by the runConfirmResponse() process to connect with the correct order data
let giTCConnectOrderQueueID = null;

// Request an order
exports.runGetOrder = (async function (apptimerCallback, callback) {
    if (confignode.config.lConsoleDataLog) {
        console.log('db getNextOrder_pr Start!');
    }

    sqlDb.close();  // close the sql db connection

    const sqlProc = "TCConnect.getNextOrder_pr"; // set the proc name
    try {
        // First get a connection pool (helps with multi threading)
        let pool = await sqlDb.connect(settings.dbConfig).catch((err) => {
            // Write sql connect error information to a log file if "catch" fires
            utils.writeLog(confignode.config.lErrorConsoleLog, 
                confignode.config.lErrorWrite,
                'Connection failure for dbConfig sendResp err = '+err);
            utils.writeLog(confignode.config.lErrorConsoleLog, 
                confignode.config.lErrorWrite,
                'Connection failed user for '+settings.dbConfigLog.user+
                ' Computer Name: '+confignode.config.cComputerName);

            sqlDb.close();
            apptimerCallback(true);
            return;  // return (bail) if connection failed
        });

        if(typeof pool=='undefined') {
            console.log('Bailing early out of process since TCConnect.getNextOrder_pr connection did not work!');
            return;
        } 

        // Send the request for orders to sql
        await pool.request()
            .output('cTCConnectURL', sqlDb.VarChar(300))  // retrieve the TC Connect URL
            .output('iTCConnectOrderQueueID', sqlDb.Int)  // retrieve the PK in the order to be used later when needed for the order confirmation call
            .output('cOrder', sqlDb.VarChar('max')) // receive the order (if there is one)
            .execute(sqlProc) // actually run the proc
            .then((cOutput) => {  // and receive the output

                //console.log('db output!')
                if(confignode.config.lVerboseConsoleLog){
                    console.log('db cOutput = ',cOutput);
                }
                // If the output does not have a valid primary key returning from sql, i.e. iTCConnectOrderQueueID, then no work to do
                if(cOutput.output.iTCConnectOrderQueueID == null) {
                    giTCConnectOrderQueueID = null;
                } else {
                    console.log('db TCConnect.getNextOrder_pr cOutput iTCConnectOrderQueueID = ',cOutput.output.iTCConnectOrderQueueID);
                    giTCConnectOrderQueueID = cOutput.output.iTCConnectOrderQueueID;
                }

                if(giTCConnectOrderQueueID == null) { // if null, then no order returned.
                    callback({body:'', status: 'null row'});

                    if(confignode.config.lBasicConsoleLog){
                        console.log('db TCConnect.getNextOrder_pr: null row returned .... main loop');
                    }
                } else {
                    if(confignode.config.lBasicConsoleLog){
                        console.log('db TCConnect.getNextOrder_pr data iTCConnectOrderQueueID returned = ', giTCConnectOrderQueueID);
                    }
                    // call the callback with valid data
                    callback({'iTCConnectOrderQueueID':giTCConnectOrderQueueID,
                        'cTCConnectURL':cOutput.output.cTCConnectURL,
                        'cOrder':cOutput.output.cOrder,
                         'status': 'runSendAgain'})
                }
                sqlDb.close();
             })
    } catch (err) {
        console.log(err);
        sqlDb.close();
        utils.writeLog(confignode.config.lErrorConsoleLog, 
            confignode.config.lErrorWrite,
            'FINAL error handler for sqlDb. TCConnect.getNextOrder_pr err = '+err);
    }
});

// If there is a sql error but no "catch"es fired above, the do a final test for errors, log and bail
sqlDb.on('error', (err) => {
    sqlDb.close();
    utils.writeLog(confignode.config.lErrorConsoleLog, 
        confignode.config.lErrorWrite,
        'FINAL error handler for sqlDb. err = '+err);
});

// when the TC Connect web site has been hit, send the result to the following sql procedure, i.e. sqlProc contents
exports.runConfirmResponse = (async function (cInput,iTCConnectOrderQueueID, apptimerCallback,  callback) {
    if(confignode.config.lVerboseConsoleLog) {
        console.log('db TCConnect.receiveOrderConfirm_pr in cInput: ',cInput);
        console.log('db TCConnect.receiveOrderConfirm_pr in iTCConnectOrderQueueID: ',iTCConnectOrderQueueID);
    }

    // Receive the data from accio and save it off in this operation
    const sqlProc = "gaClient.TCConnect.receiveOrderConfirm_pr"
    try {
        // First set up a connection pool
        let pool = await sqlDbConfirm.connect(settings.dbConfig).catch((err) => {
            utils.writeLog(confignode.config.lErrorConsoleLog, 
                confignode.config.lErrorWrite,
                'Connection failure for dbConfig confirm err = '+err);
            utils.writeLog(confignode.config.lErrorConsoleLog, 
                confignode.config.lErrorWrite,
                'Connection failed user for '+settings.dbConfigLog.user+
                ' Computer Name: '+confignode.config.cComputerName);
            callback(null,err);
            apptimerCallback(true);
            return;  // return (bail) if connection failed

        });
        // Next, do the actual request to the back end with the proc sqlProc defined above
        await pool.request()
            .input('iTCConnectOrderQueueID', sqlDbConfirm.Int, iTCConnectOrderQueueID) // pass in the primary key to the order
            .input('jOrderConfirmation', sqlDbConfirm.VarChar(8000), cInput) // pass in the JSON returned from the call to the TC Connect site
            .output('lSuccess', sqlDb.bit) // was there succes or not?
            .execute(sqlProc) // actually run the proc
            .then((cOutput) => {
                if(settings.lConsoleDataLog) {
                    console.log('db gaClient.TCConnect.receiveOrderConfirm_pr cOutput : ',cOutput);
                }
                // pass the success flag
                callback(cOutput.output.lSuccess);
                sqlDbConfirm.close();

             }).catch( (err) => {
                sqlDbConfirm.close();
                utils.writeLog(confignode.config.lErrorConsoleLog, 
                    confignode.config.lErrorWrite,
                    'EXEC gaClient.TCConnect.receiveOrderConfirm_pr catch err = '+err);
                    //callback(null, err);
            });
    } catch (err) {
        sqlDbConfirm.close();
        utils.writeLog(confignode.config.lErrorConsoleLog, 
            confignode.config.lErrorWrite,
            'FINAL error handler for sqlDbConfirm. catch err = '+err);
    }
});

// catch any final errors that were not caught earlier
sqlDb.on('error', (err) => {
    sqlDbConfirm.close();
    utils.writeLog(confignode.config.lErrorConsoleLog, 
        confignode.config.lErrorWrite,
        'FINAL error handler for sqlDbConfirm. err = '+err);
});
