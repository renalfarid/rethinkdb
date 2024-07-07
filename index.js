const express = require('express');
var cors = require('cors');

const r = require('rethinkdb');
const WebSocket = require('ws');


const app = express();
const port = 3000;

app.use(cors())


app.use(express.json());

let conn = null;

// Connect to RethinkDB
r.connect({ host: 'localhost', port: 55007 }, (err, connection) => {
  if (err) throw err;
  conn = connection;

  const server = app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });

  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    console.log('New WebSocket connection');
  });

  r.dbCreate('test').run(conn, (err, res) => {
    if (err) console.log('Database already exists.');
    else console.log('Database created.');
  });

  r.db('test').tableCreate('users').run(conn, (err, res) => {
    if (err) console.log('Table already exists.');
    else console.log('Table created.');
  });

  // Set up RethinkDB change feed
  r.db('test').table('users').changes().run(conn, (err, cursor) => {
    if (err) throw err;
    cursor.each((err, change) => {
      if (err) throw err;
      console.log(JSON.stringify(change));
      // Broadcast change to all connected WebSocket clients
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(change));
        }
      });
    });
  });
});

// API endpoint to get users
app.get('/api/users', (req, res) => {
  r.db('test').table('users').run(conn, (err, cursor) => {
    if (err) {
      res.status(500).send(err);
      return;
    }
    cursor.toArray((err, results) => {
        if (err) {
          res.status(500).send(err);
          return;
        }
        res.send(results);
      });
  
  });
});

// API endpoint to add a user
app.post('/api/users', (req, res) => {
  const user = req.body;
  r.db('test').table('users').insert(user).run(conn, (err, result) => {
    if (err) {
      res.status(500).send(err);
      return;
    }
    res.send(result);
  });
});

// API endpoint to update a user
app.put('/api/users/:id', (req, res) => {
    const userId = req.params.id;
    const newAge = req.body.age;
    r.db('test').table('users').get(userId).update({ age: newAge }).run(conn, (err, result) => {
      if (err) {
        res.status(500).send(err);
        return;
      }
      res.send(result);
    });
  });