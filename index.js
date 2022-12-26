const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

require('dotenv').config()


const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Wellcome to Your Car server');
})

const uri = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@testing.wbduv4j.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


async function run() {
    try {
        const eventCollection = client.db('dev-soft-task').collection('events');
        const userEventCollection = client.db('dev-soft-task').collection('user-events');
        const userCollection = client.db('dev-soft-task').collection('users');

        console.log('mongo db connect');


        app.post('/jwt', async (req, res) => {
            const data = req.body;
            const uid = data.uid;
            const isBlocked = await userCollection.findOne({ uid: uid, hidden: true });
            if (isBlocked !== null) {
                res.status(403).send('Due to violation of terms and condition , your id is blocked !')
            }
            else {
                const token = jwt.sign(data, process.env.SECRET, { expiresIn: '1h' });
                res.send({ token });
            }
        });

        app.post('/add-event', async (req, res) => {
            const event = req.body;
            const result = await eventCollection.insertOne(event);
            res.send(result);
        })

        app.put('/book-event', async (req, res) => {
            const id = req.body.data;
            const user = req.body.user;
            if (user) {
                const userId = user.uid;
                const name = user.displayName;
                const email = user.email;
                const query = { _id: ObjectId(id) };
                const result = await eventCollection.findOneAndUpdate(query, { $set: { booked: true, userId, name, email, status: 'pending' } });
                const data = await eventCollection.findOne(query);
                userEventCollection.insertOne({ title: data.title, start: data.start, booked: true, userId, name, email, status: 'pending' });
                res.send(result)
            }
        })
        app.put('/update-event/:id', async (req, res) => {
            const id = req.params.id;
            const status = req.body.status;
            const query = { start: id };
            const result = await eventCollection.findOneAndUpdate(query, { $set: { status: status } });
            userEventCollection.findOneAndUpdate(query, { $set: { status: status } });
            res.send(result)
        })
        app.put('/cancel-booking/:id', async (req, res) => {
            const id = req.params.id;
            const query = { start: id };
            const result = await eventCollection.findOneAndUpdate(query, { $set: { booked: false, status: "canceled by user" } });
            userEventCollection.deleteOne(query);
            res.send(result)
        })

        app.put('/edit-booking/:id', async (req, res) => {
            const id = req.params.id;
            const slot = req.body.newSlot;
            const user = req.body.user;
            const query = { start: id };
            const newQuery = { start: slot };
            const userId = user.uid;
            const name = user.displayName;
            const email = user.email;
            const result = await eventCollection.findOneAndUpdate(query, { $set: { booked: false, status: "canceled by user" } });
            const newResult = await eventCollection.findOneAndUpdate(newQuery, { $set: { booked: true, userId, name, email, status: 'pending' } });
            const delBooking = await userEventCollection.deleteOne(query);
            const data = await eventCollection.findOne(newQuery);
            const newBookign = await userEventCollection.insertOne({ title: data.title, start: data.start, booked: true, userId, name, email, status: 'pending' });
            console.log(newBookign);
            res.send(newBookign)
        })

        app.get('/all-events', async (req, res) => {
            const projection = { title: 1, start: 1, _id: 1, booked: 1, name: 1, email: 1, status: 1 };
            const result = await eventCollection.find().project(projection).toArray();
            res.send(result);
        });

        app.get('/my-events/:uid', async (req, res) => {
            const id = req.params.uid;
            const query = { userId: id };
            const result = await userEventCollection.find(query).toArray();
            console.log(result, id)
            res.send(result);
        });

        app.post('/register', async (req, res) => {
            const user = req.body.user;
            const query = { uid: user.uid }
            const isExist = await userCollection.findOne(query);
            if (isExist) {
                return res.send('user already exists');
            }
            else {
                const result = await userCollection.insertOne(user);
                res.send(result);
            }
        })

        app.get('/user/:id', async (req, res) => {
            const id = req.params.id;
            const query = { uid: id }
            const result = await userCollection.findOne(query);
            res.send(result);
        });

    } finally {

    }
}
run().catch(err => console.log(err));

app.listen(port, () => {
    console.log('node is running on ', port);
})
