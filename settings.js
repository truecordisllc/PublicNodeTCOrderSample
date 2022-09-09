const confignode = require('./confignode');

if(confignode.config.lIsProduction==null) {
    exports.lProductionDB = true; //(process.env.ACCIO_CLIENT_SQL_PROD  == 'false' ? false : true);
} else {
    exports.lProductionDB = confignode.config.lIsProduction;
}



exports.lConsoleDataLog = confignode.config.lConsoleDataLog; 

// Set the primary window to request work from sql, e.g., starrt up at 2 am and end at 11:30 pm
// this down time allows some time for maintenance processes to work
// though technically we can do 24/7 with few exceptions
exports.open_time = "02:00:00";

exports.close_time = "22:30:00";

//Config data... some hardcoded... some pulled from env vars
exports.appConfig = {
    name:'nodeTCOrderSample',
    nameShort:'tc-order-sample',
    version:'1.00',
    author:'Jerry Breitling',
    created:'09/04/2022',
    lastModified:'09/09/2022',
    purpose:"Send sample orders to TC Connect",
    update:""
}

// connection creds for general sql processing for test
// In production, use secrets or environment vars to store server, database, user, and password
const dbConfigProduction = {
    server: '***********************',
    database: '***********',
    user: '**********',
    password: '**************'
};

if(exports.lProductionDB ) {
    exports.dbConfig = dbConfigProduction;
} else {
    exports.dbConfig = dbConfigTest;
}


exports.display = (function() {
    console.log('=================== BEGIN SETTINGS DISPLAY');
    
    console.log('Is Production? ',(exports.lProductionDB ? '"Yes"' : '"No"'));
    console.log('do we log the db info? ',(exports.lConsoleDataLog ? '"Yes"' : '"No"'));

    // display primary database creds except hide password 
    let dbConfigDisplay = Object.assign({},exports.dbConfig);
    dbConfigDisplay.password = '**********'
    console.log('the primary db config settings: ',dbConfigDisplay);
    console.log('basic config settings: ',confignode.config);

    console.log('=================== END SETTINGS DISPLAY');
});

