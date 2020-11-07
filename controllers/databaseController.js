const { Pool } = require('pg');

// connectionString format -> "postgres://*USERNAME*:*PASSWORD*@*HOST*:*PORT*/*DATABASE*"
var connectionString = process.env.DATABASE_URL || "postgres://postgres:dbpass@localhost:5432/urlsdb";

// create a connection pool for postgresql

const pool = new Pool({
    connectionString: connectionString,
    ssl: {
        rejectUnauthorized: false
    }
});

// the pool will emit an error on behalf of any idle clients
// it contains if a backend error or network partition happens
pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err)
    process.exit(-1)
})




// function to ROLLBACK if there is an error
const shouldAbort = (err, client, done) => {
    // Make sure to release the client before any error handling,
    if (err) {
        console.error('Error in transaction', err.stack)
        client.query('ROLLBACK', err => {
            if (err) {
                console.error('Error rolling back client', err.stack)
            }
            // release the client back to the pool
            done()
        })
    }
    return !!err
}

// function to create the table
function createUrlsTable() {

    var query = `
    CREATE TABLE urls(
        ID SERIAL not null PRIMARY KEY ,
        Url text
        );
        `;
    pool.connect((err, client, done) => {
        if (err)
            throw err;
        client.query('BEGIN', (err) => {
            if (shouldAbort(err, client, done)) return
            client.query(query, (err, res) => {
                if (shouldAbort(err, client, done)) return
                client.query('COMMIT', err => {
                    if (err) {
                        console.error('Error committing transaction', err.stack)
                    } else {
                        console.log("table created!");
                    }
                    done()
                });
            });
        });
    });
}


// function to check if the "urls" table exists or not if not then creates the table
function checkAndCreateTable() {
    var query = `
        SELECT EXISTS(
            SELECT *
            FROM pg_catalog.pg_tables
            WHERE schemaname != 'pg_catalog' AND 
            schemaname != 'information_schema' AND tablename = 'urls');
            `;
    pool.connect((err, client, done) => {
        if (err) throw err;
        client.query(query, (err, res) => {
            done();
            if (err) {
                console.log(`Caught error while checking the existance of the "urls" table`);
                console.log(err.stack);
            } else {
                var tableExists = res.rows[0]['exists'];
                if (!tableExists) {
                    console.log(`Creating the "urls" table...`);
                    createUrlsTable();
                }
                else {
                    console.log(`Table "urls" already exists. No need to create it.`);
                }
            }
        });
    });

}

// function to insert a url to the urls table
function insertUrl(url) {
    var query = `
        insert into urls values (default,'${url}');
    `;
    pool.connect((err, client, done) => {
        if (err)
            throw err;
        client.query('BEGIN', (err) => {
            if (shouldAbort(err, client, done)) return
            client.query(query, (err, res) => {
                if (shouldAbort(err, client, done)) return
                client.query('COMMIT', err => {
                    if (err) {
                        console.error('Error committing transaction', err.stack)
                    } else{
                        console.log("url inserted!");
                    }
                    done();
                });
            });
        });
    });
}

// function to get the url by ID
function getUrlByID(ID) {
    var query = `
        select URL from urls where ID=${ID};
    `;
    pool.connect((err,client,done)=>{
        if(err)
            throw err;
        client.query(query,(err,res)=>{
            if(err)
                throw error;
            var urlExists = (res.rows.length==1);
            if(urlExists){
                console.log(res.rows[0]);
            }
            else{
                console.log("url with given ID not found!");
            }
        });
    });
}

// exports
module.exports.checkAndCreateTable = checkAndCreateTable;
module.exports.insertUrl = insertUrl;
module.exports.getUrlByID = getUrlByID;