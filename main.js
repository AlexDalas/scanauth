const express = require('express');
const bodyParser = require('body-parser');
const https = require('https');
const fs = require('fs');
const app = express();
const csvWriter = require('csv-write-stream');
const mysql = require('mysql');
var cookieParser = require('cookie-parser')
const schedule = require('node-schedule');
const crypto = require('crypto');
const proToken = crypto.randomBytes(20).toString('hex');
console.log(`Token for this session is ${proToken}`)

passwords = ["TestUser"];
timeZone = "Australia/Victoria"
var con = mysql.createConnection({
    host: "localhost",
    user: "-",
    password: "-",
    database: "scanauth",
    uri: process.env.DATABASE_URL,
    multipleStatements: false,
    dateStrings: true
});

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser())

let fileStream;

function getDateISO(date){
    return date.toLocaleDateString('en-US', { timeZone: timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2');
}

console.log(`---\nStarting script on ${getDateISO(date)} at ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}\n---`)

con.query(`CREATE TABLE IF NOT EXISTS users (id INT NOT NULL AUTO_INCREMENT, name VARCHAR(255) NOT NULL, surname VARCHAR(255) NOT NULL, created BIGINT NOT NULL, PRIMARY KEY(id));`, (error, results) => {
    if (error) {
        console.log(`----------\nERROR OCCURED\n----------\n${error}\n----------\n`);
    } else {
        if (!results.warningCount){
            console.log(`Created table 'users'`);
        }
        else{
            console.log(`Table 'users' already exists`);
        }
    }
});  

con.query(`CREATE TABLE IF NOT EXISTS records (id INT NOT NULL AUTO_INCREMENT, userid VARCHAR(255) NOT NULL, date DATE NOT NULL, PRIMARY KEY(id));`, (error, results) => {
    if (error) {
        console.log(`----------\nERROR OCCURED\n----------\n${error}\n----------\n`);
    } else {
        if (!results.warningCount){
            console.log(`Created table 'records'`);
        }
        else{
            console.log(`Table 'records' already exists`);
        }
    }
});  

con.query(`CREATE TABLE IF NOT EXISTS settings (setting VARCHAR(255) NOT NULL, value BOOL NOT NULL, PRIMARY KEY(setting));`, (error, results) => {
    if (error) {
        console.log(`----------\nERROR OCCURED\n----------\n${error}\n----------\n`);
    } else {
        if (!results.warningCount){
            con.query('INSERT INTO settings (setting, value) VALUES (?, ?)', ["registrations", true], (error) => {
                if (error) {
                    console.log(`----------\nERROR OCCURED\n----------\n${error}\n----------\n`);
                    return 500;
                } else {
                    if (error) {
                        console.log(`----------\nERROR OCCURED\n----------\n${error}\n----------\n`);
                        return 500;
                    } else {
                        return 200;
                    }
                }
            });
            console.log(`Created table 'settings'`);
        }
        else{
            console.log(`Table 'settings' already exists`);
        }
    }
});  

con.query(`CREATE TABLE IF NOT EXISTS codes (code VARCHAR(255) NOT NULL, date DATE, PRIMARY KEY(code));`, (error, results) => {
    if (error) {
        console.log(`----------\nERROR OCCURED\n----------\n${error}\n----------\n`);
    } else {
        if (!results.warningCount){
            console.log(`Created table 'codes'`);
        }
        else{
            console.log(`Table 'codes' already exists`);
        }
    }
});  

function createUser(firstName, lastName){
    con.query('INSERT INTO users (name, surname, created) VALUES (?, ?, ?)', [firstName, lastName, Date.now()], (error) => {
        if (error) {
            console.log(`----------\nERROR OCCURED\n----------\n${error}\n----------\n`);
            return 500;
        } else {
            if (error) {
                console.log(`----------\nERROR OCCURED\n----------\n${error}\n----------\n`);
                return 500;
            } else {
                return 200;
            }
        }
    });
}

var options = {
    key: fs.readFileSync('pk.key'),
    cert: fs.readFileSync('cert.crt'),
};

var server = https.createServer(options, app).listen(5000, function(){
    console.log("\nYou can access the server");
});

app.get('/api/', (req, res) => {
    res.json({code: 200})
})

app.post('/api/authpwd', (req, res) => {
    if (passwords.includes(req.body.pwd)){
        res.json({code: 200, tk: proToken});
    }else{
        res.json({code: 400});
    }
})

function isAdmin(req){
    console.log(req.cookies['token'] == proToken)
    if (req.cookies['token'] == proToken){
        return true;
    }
    else{
        return false;
    }
}

app.post('/api/users', (req, res) => {
    var datetime = new Date();
    if (isAdmin(req)){
        con.query('SELECT * FROM users', (error, results) => {
            con.query('SELECT * FROM records WHERE date = ?', [getDateISO(date)], (error, recordResults) => {
                if (error) {
                    console.log(`----------\nERROR OCCURED\n----------\n${error}\n----------\n`);
                    res.json({code: 500})
                } else {
                    console.log(recordResults)
                    let userids = recordResults.map(function(item) {
                        return item.userid;
                    });
                    res.json({code: 200, users: results, disabled: userids})
                }
            });
        });
    }else{
        con.query('SELECT * FROM codes WHERE code = ?', [req.body.code], (error, results) => {
            if (!results[0]) return res.json({code: 400});
            console.log(results);
            console.log(getDateISO(date)); 
            if (results[0].date.toString().slice(0,10) === getDateISO(datetime)){
                con.query('SELECT * FROM users', (error, results) => {
                    con.query('SELECT * FROM records WHERE date = ?', [getDateISO(datetime)], (error, recordResults) => {
                        if (error) {
                            console.log(`----------\nERROR OCCURED\n----------\n${error}\n----------\n`);
                            res.json({code: 500})
                        } else {
                            console.log(recordResults)
                            let userids = recordResults.map(function(item) {
                                return item.userid;
                            });
                            res.json({code: 200, users: results, disabled: userids})
                        }
                    });
                });
            }
            else{
                return res.json({code: 400});
            }
        });
    }
})

app.post('/api/signin', (req, res) => {
    // Only allow 1 signin for non admins
    req.body.users.forEach(user => {
        var datetime = new Date();
        con.query('INSERT INTO records (userID, date) VALUES (?, ?)', [user, getDateISO(datetime)], (error) => {
            if (error) {
                console.log(`----------\nERROR OCCURED\n----------\n${error}\n----------\n`);
                return 500;
            } else {
                if (error) {
                    console.log(`----------\nERROR OCCURED\n----------\n${error}\n----------\n`);
                    return 500;
                } else {
                    return 200;
                }
            }
        });
    });
    res.json({code: 200})
})

app.post('/api/isadmin', (req, res) => {
    if (isAdmin(req)){
        res.json({code: 200});
    }else{
        res.json({code: 400});
    }
})

app.post('/api/gencode', (req, res) => {
    if (isAdmin(req)){
        var datetime = new Date();    
        let codeResult = '';
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        for (let i = 0; i < 4; i++) {
            codeResult += characters.charAt(Math.floor(Math.random() * characters.length));
            codeResult += Math.floor(Math.random() * 10);
        }
        con.query('INSERT INTO codes (code, date) VALUES (?, ?)', [codeResult, getDateISO(datetime)], (error) => {
            if (error) {
                console.log(`----------\nERROR OCCURED\n----------\n${error}\n----------\n`);
                res.json({code: 500, URLcode: codeResult})
            } else {
                if (error) {
                    console.log(`----------\nERROR OCCURED\n----------\n${error}\n----------\n`);
                    res.json({code: 500, URLcode: codeResult})
                } else {
                    res.json({code: 200, URLcode: codeResult})
                }
            }
        });
    }
    else{
        res.json({code: 404})
    }
})


app.post('/api/signup', (req, res) => {
    if (isAdmin(req)){
        con.query('SELECT * FROM settings WHERE setting = ?', ["registrations"], (error, results) => {
            if (error) {
                console.log(`----------\nERROR OCCURED\n----------\n${error}\n----------\n`);
                res.json({code: 500})
            } else {
                if (results[0].value || req.body.bypass === true){
                    console.log(req.body)
                    var result = createUser(req.body.name, req.body.surname);
                    res.json({code: 200})
                }else{
                    res.json({ code: 500 })
                }
            }
        });
    }
})

app.post('/api/deleteuser', (req, res) => {
    if (isAdmin(req)){
        console.log(req.body.id)
        con.query('DELETE FROM users WHERE id = ?', [req.body.id], (error) => {
            con.query('DELETE FROM records WHERE userid = ?', [req.body.id], (error) => {
                if (error) {
                    console.log(`----------\nERROR OCCURED\n----------\n${error}\n----------\n`);
                    res.json({code: 500 })
                } else {
                    if (error) {
                        console.log(`----------\nERROR OCCURED\n----------\n${error}\n----------\n`);
                        res.json({code: 500 })
                    } else {
                        res.json({code: 200 })
                    }
                }
            });
        });
    }else{
        res.json({code: 400});
    }
})

app.post('/api/updatename', (req, res) => {
    if (isAdmin(req)){
        console.log(req.body.name)
        console.log(req.body.id)
        let index = req.body.name.indexOf(' ');
        if (index === -1) {
            return res.json({code: 501});
        }
        else{
            let result = [req.body.name.slice(0,index), req.body.name.slice(index+1)];
            con.query('UPDATE users SET name = ?, surname = ? WHERE id = ?', [result[0], result[1], req.body.id], (error, recordResults) => {
                if (error) {
                    console.log(`----------\nERROR OCCURED\n----------\n${error}\n----------\n`);
                    res.json({code: 500})
                } else {
                    res.json({code: 200})
                }
            });
        }
    }else{
        res.json({code: 400});
    }
})

app.post('/api/editsetting', async (req, res) => {
    if (isAdmin(req)) {
      switch (req.body.item) {
        case 'REG':
          con.query(`UPDATE settings SET value = NOT value WHERE setting = 'registrations'`, (error, recordResults) => {
            if (error) {
              console.log(`Error updating settings: ${error}`);
              res.json({ code: 500 });
              return;
            }
            console.log(`Settings updated: ${recordResults}`);
            res.json({ code: 200 });
          });
          break;
        case 'DOWNLOAD':
            //datefrom = '2023-03-04'
           // dateto = '2023-04-23'
            datefrom = req.body.from
            dateto = req.body.to
          con.query(`SELECT DISTINCT date FROM records WHERE date BETWEEN ? AND ? ORDER BY date ASC`, [datefrom, dateto], (error, dateResults) => {
            if (error) {
              console.log(`Error getting dates: ${error}`);
              res.json({ code: 500 });
              return;
            }
            const dates = dateResults.map(dateResult => dateResult.date);
            con.query(`SELECT userid, date FROM records WHERE date BETWEEN ? AND ? ORDER BY date ASC`, [datefrom, dateto], (error, recordResults) => {
                if (error) {
                  console.log(`Error getting records: ${error}`);
                  res.json({ code: 500 });
                  return;
                }
                con.query(`SELECT id, name, surname FROM users`, (error, usersInc) => {
                    const usersDict = {};
                    for (const user of usersInc) {
                      const { id, name, surname } = user;
                      usersDict[id] = `${name} ${surname}`;
                    }
                    if (error) {
                      console.log(`Error getting records: ${error}`);
                      res.json({ code: 500 });
                      return;
                    }
                    const data = {};
                    recordResults.forEach(recordResult => {
                      if (!data[recordResult.date]) {
                        data[recordResult.date] = {};
                      }
                      data[recordResult.date][recordResult.userid] = true;
                    });
                    const rows = [['User', ...dates]];
                    const userIds = Object.keys(data).reduce((acc, date) => {
                      Object.keys(data[date]).forEach(userId => {
                        if (!acc.includes(userId)) {
                          acc.push(userId);
                        }
                      });
                      return acc;
                    }, []);

                    userIds.forEach(userId => {
                      const row = [userId];
                      dates.forEach(date => {
                        row.push(data[date] && data[date][userId] ? '1' : '0');
                      });
                      rows.push(row);
                    });

                    for (let i = 1; i < rows.length; i++) {
                        const userId = rows[i][0];
                        const userName = usersDict[userId];
                        if (userName === undefined) {
                          rows[i][0] = `Deleted user ${userId}`;
                        } else {
                          rows[i][0] = userName;
                        }
                    }

                    const csv = rows.map(row => row.join(',')).join('\n');
                    res.setHeader('Content-disposition', 'attachment; filename=records.csv');
                    res.set('Content-Type', 'text/csv');
                    res.status(200).send(csv);
                });
            });
          });
          break;
      }
    } else {
      res.json({ code: 400 });
    }
  });

app.post('/api/getsettings', (req, res) => {
    if (isAdmin(req)){
        con.query('SELECT * FROM settings WHERE setting = ?', ["registrations"], (error, results) => {
            if (error) {
                console.log(`----------\nERROR OCCURED\n----------\n${error}\n----------\n`);
                res.json({code: 500})
            } else {
                resText = "Disabled"
                if (results[0].value){resText="Enabled";}
                res.json({ code: 200, registrations: resText })
            }
        });
    }else{
        res.json({code: 400});
    }
})