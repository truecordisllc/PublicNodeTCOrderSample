/* TrueCordis Order Tester and Sample code for client to build a system to push orders to TC Connect

If desired, I can also provide SQL code/scripts

*/
"use strict";
const settings = require('./settings'); // local settings
const confignode = require('./confignode');  // local configuration
const db = require('./core/db'); // local database calls to do back end work
const axios = require('axios');  // Module to POST information to a RESTful API server

var os = require('os');
confignode.config.cComputerName = os.hostname();  // Use the os module to capture the host name and define a property that can be used for logging (used to id this computer)

const EventEmitter = require('events');  // Use the "events" module to help set up a timer to poll the back end, in this case, SQL Server

const utils = require('./core/utils'); // access the writeLog function

class MyEmitter extends EventEmitter {}

// set module wide vars
let tBasicLoopID = null; // timer handle

const repeatedEmitter = new MyEmitter();

repeatedEmitter.on('event', () => {
    // Stop the timer
    clearTimeout(tBasicLoopID);
    if(confignode.config.lBasicConsoleLog) {
        console.log('app repeatedEmitter: an event occurred!');
    }

    // First, check the back end to see if there are any orders to send to TCConnect
    db.runGetOrder(startVeryLongLoop, (resp) => {
            // extensive logging has been removed since it over complicates the code.
            // but some logging to console remains to help in the debugging process
            if(confignode.config.lVerboseConsoleLog) {
                console.log('app runGetOrder() resp = ',resp);
            }

            // No records returned? (nothing to do? then reset timer and bail)
            if(resp.status === 'null row') {
                console.log('app runGetOrder() resp.status === "null row" or "nothing to do!"',{"is":'GOOD',"time":Date()});
                startLongLoop(true);
                return; //return which skips the post and waits for the next loop cycle
            }

            // There is work to do so prepare to run a quick 
            if(resp.status === 'runSendAgain')  {
                console.log('app runGetOrder() resp.status === "runSendAgain" ',{is:'GOOD',"time":Date()})
            };
            // So now we should have a legit order returned from the backend
            if(confignode.config.lBasicConsoleLog) {
                console.log('resp.cTCConnectURL = ',resp.cTCConnectURL)
            };
            // Now with valid data to send do the POST to the correct URL
            // note that resp is still in scope in the POST section

            // add to azios to set its timer to 20 seconds
            let queryString = {"timeout": 20000 };

            // Misc logging
            if(confignode.config.lBasicConsoleLog) {
                console.log('step 0: pre axios queryString = ',queryString);
                console.log('start axios.post()',{"time":Date()});
            };
            
            console.log('prepare to send to TCConnect site ',resp.cOrder);
            console.log('json.parse data ',JSON.parse(resp.cOrder));

            // Note that JSON.parse around the data to send is optional (works with or without)

            // Hit the TC Connect web site with a payload and hopefully get a good response
            axios.post(resp.cTCConnectURL, JSON.parse(resp.cOrder), queryString ).then((response) => {
                    if(confignode.config.lBasicConsoleLog) {
                        console.log('axios step 1: first log inside of axios.post(...)')
                    };
                    if(confignode.config.lVerboseConsoleLog) {
                        // Display EVERYTHING received as a response from AXIOS/TC Connect
                        console.log('full response from TCConnect = ',response);
                    };

                    // Was POST successful?
                    if (response.status == 200) {
                        if(confignode.config.lBasicConsoleLog) {
                            console.log('display rgiTCConnectOrderQueueID from initial call to back end = ',resp.iTCConnectOrderQueueID);
                            console.log('step 2: prepare to runConfirmResponse()');
                            console.log('response from TCConnect => response.data = ',response.data);
                            console.log('do a JSON.stringify around the data= ',JSON.stringify(response.data));
                        }
                        // finally run the confirmation back end call
                        db.runConfirmResponse( JSON.stringify(response.data) ,resp.iTCConnectOrderQueueID,
                                startVeryLongLoop, (returnInfo,err) => {

                            if(confignode.config.lBasicConsoleLog) {
                                console.log('step 3: return info for runConfirmResponse()')
                            };

                            if(settings.lConsoleDataLog) {
                                if(err) {
                                    console.log('app error: ', err);
                                }
                                console.log('The returnInfo from  runConfirmResponse if lSuccess is = ',returnInfo);
                            };

                        //return, i guess, which skips the post and waits for the next loop cycle
                        }).then(() => {
                            if(confignode.config.lBasicConsoleLog) {
                                console.log('step 4: then()  for runConfirmResponse()')
                            };
                            
                            if(settings.lConsoleDataLog) {
                                console.log('Finished runConfirmResponse and reseting loop ');
                            }
                            startShortLoop(false);
                        }).catch(() => {
                            console.log('step 5: catch()  for runConfirmResponse()')
                            console.log('Finished runConfirmResponse AND FAILED but reseting loop ');
                            startLongLoop(true);

                        });
                    } else {
                        // We go here when there is an axios failure to get a good response from the hit to TC Connect
                        console.log('step 6: NOT response.status == 200 for axios()')

                        // here we need to log the failure of the post!!!
                        utils.writeLog(confignode.config.lErrorConsoleLog, 
                            confignode.config.lErrorWrite,
                            'Failed post! user for '+settings.dbConfigLog.user+
                            ' Computer Name: '+confignode.config.cComputerName);
           
                    }
                }).catch((err)   => {
                    // axios has experienced an error. Why? will try to determine and run the confirm 
                    console.log('step 7 axios catch()',{"time":Date()})

                    console.error(' the catch error = ',err)
                    let jMessage = {"tcinterface":{"iCode":-20,"cMessage":"Problem with axios post request."}}
                    if(err.response) {
                        console.log('axios post error response data = ',err.response);
                        //console.log('axios post error response status = ',error.response.status);
                        //console.log('axios post error response headers = ',error.response.headers);

                        if(err.response.status ===404) {
                            jMessage = {"tcinterface":{"iCode":-23,"cMessage":"Client site not found."}}
                            console.log('Error: Page not found (404)');
                        }
                    } else if(err.code = 'ECONNREFUSED') {
                        jMessage = {"tcinterface":{"iCode":-23,"cMessage":"Client site/app not found."}}
                        console.log('Error: Site/Page not found (404)',jMessage);

                    } else if (err.request){
                        // request was made but no response
                        jMessage = {"tcinterface":{"iCode":-21,"cMessage":"Client URL timed out."}}
                        console.error('axios timeout = ',jMessage);
                        //console.error('axios timeout = ',err.request);
                    } else {
                        jMessage = {"tcinterface":{"iCode":-22,"cMessage":"Misc error = "+err.message}}
                        console.error('axios error message = ',jMessage);
                    }
 
                    // if under axios.catch() we also run runConfirmResponse to record error
                    db.runConfirmResponse(JSON.stringify(jMessage) ,resp.iTCConnectOrderQueueID,
                        startVeryLongLoop, (returnInfo,err) => {

                            console.log('step 8 runConfirmResponse() catch()')

                            if(settings.lConsoleDataLog) {
                            if(err) {
                                console.log('app runConfirmResponse() error: ', err);
                            }
                            console.log('axios error runConfirmResponse() returnInfo = ',returnInfo);
                        }
                        //return, i guess, which skips the post and waits for the next loop cycle
                    }).then(() => {
                        if(settings.lConsoleDataLog) {
                            console.log('Finished runConfirmResponse and reseting loop ');
                        }
                        startShortLoop(false);
                    }).catch(() => {
                        console.log('Finished runConfirmResponse AND FAILED but reseting loop ');
                        startLongLoop(true);

                    });
            });
        });
});

// Define the timing loops  

// This one functions after hours, i.e. between open_time and close_time defined in settings.js
const startVeryLongLoop =  (async function(lClear) {
    if(lClear) {
        clearTimeout(tBasicLoopID);
        console.log('app timer stopped (called by startVeryLongLoop).')
    }
    tBasicLoopID = setTimeout(loop, confignode.config.iVeryLongLoop);
    console.log('app VERY long loop timer started. ')
});

const startLongLoop =  (async function(lClear) {
    if(lClear) {
        clearTimeout(tBasicLoopID);
        if(confignode.config.lBasicConsoleLog) {
            console.log('app timer stopped (called by startLongLoop).');
        }
    }

    tBasicLoopID = setTimeout(loop, confignode.config.iLongLoop);
    if(confignode.config.lBasicConsoleLog) {
        console.log('app long loop timer started. ');
    }
});

const startShortLoop =  (async function(lClear) {
    if(lClear) {
        clearTimeout(tBasicLoopID);
        if(confignode.config.lBasicConsoleLog) {
            console.log('app timer stopped (called by startShortLoop).')
        }
    }

    tBasicLoopID = setTimeout(loop, confignode.config.iShortLoop);
    if(confignode.config.lBasicConsoleLog) {
        console.log('app short loop timer started.');
    }
});


function loop() {
    let now = new Date();
    //console.log('Received post. Time: ',now);

    console.log('START PRIMARY LOOP=== time=',now)
    //console.log('setup primary loop with repeatedEmitter.emit("event");')
    // Check to see if the window is correct to run the prog.
    if(checkTime(Date.now())) {
        repeatedEmitter.emit('event');
        // Then start the long loop process
        //startLongLoop(true);
    } else {
        // Then start the startVeryLongLoop process
        startVeryLongLoop(true);

    }
}


// check to see if time is during "open" hours
function checkTime(currentTime) {

    //console.log(currentTime);
    let date = new Date(currentTime);
    let currentFormatTime = date.toLocaleTimeString('en-US', {hour12: false})
    if(confignode.config.lBasicConsoleLog) {
        console.log('Current formatted time: ',currentFormatTime);
    }
    if( currentFormatTime >= settings.open_time && currentFormatTime <= settings.close_time ) {
        return true;
    } else { 
        return false;
    }

};

settings.display();
// now run the loop:
console.log('===============================Start main loop!');
repeatedEmitter.emit('event');
console.log('===============================End setup!');

// fire off the main loop
loop();

// then remain looping via timers





