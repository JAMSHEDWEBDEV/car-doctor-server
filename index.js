const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

// middleware start
app.use(cors({
  origin:['http://localhost:5173'],
  credentials:true
}));
app.use(express.json()); 
app.use(cookieParser());
// middleware end
// middlewares 
const logger = (req,res,next) =>{
  console.log('log:info',req.method, req.url);
  next()
}
const verifyToken = (req,res,next) =>{
  const token = req?.cookies?.token;
  console.log('token in the middleware', token);
  if(!token){
    return res.status(401).send({message:'unauthorized access'});
  }
  jwt.verify(token,process.env.ACCESS_TOKEN_SECRETE,(err,decode)=>{
      if(err){
        return res.status(401).send({message:'unauthorized access'});
      }
      req.user = decode;
      next();
  })
  
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.tyaaup2.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const serviceCollection = client.db('carDoctor').collection('services');
    const bookingCollection = client.db('carDoctor').collection('bookings');
    
    // auth related api start 

    app.post('/jwt', async(req,res)=>{
      const user = req.body;
      console.log('user for token',user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRETE, {expiresIn: '1h'})
      res.cookie('token',token,{
        httpOnly: true,
        secure: true,
        sameSite: 'none'
      })
      .send({success:true});
    })

    app.post('/logOut', async(req,res)=>{
      const user = req.body;
      console.log('logging Out', user);
      res.clearCookie('token',{maxAge:0}).send({success:true})
    })


    // services related api start 
    // get/read data from database and show client side services  
    app.get('/services', async(req,res)=>{
        const cursor = serviceCollection.find();
        const result = await cursor.toArray();
        res.send(result);
    })

    // specific data get from database 
    app.get('/services/:id', async(req,res)=>{
      const id = req.params.id;
      const query = { _id: new ObjectId(id)};
      const options = {
        // Include only the `title` and `imdb` fields in the returned document
        projection: { _id: 0, title: 1, price: 1, img:1 },
      };
      const result = await serviceCollection.findOne(query,options);
      res.send(result);
    })
    // get booking data from database 
    app.get('/bookings', logger,verifyToken, async(req,res)=>{
      // console.log(req.query.customerEmail);
      console.log('token owner info', req.user);
      if(req.user.email !== req.query.customerEmail){
        return res.status(403).send({message:'forbidden access'});
      }
      let query = {};
      if(req.query?.customerEmail){
        query = {customerEmail:req.query.customerEmail}
      }
      const result = await bookingCollection.find(query).toArray();
      res.send(result);

    })

    // post bookings data in database 
    app.post('/bookings', async(req,res)=>{
         const booking = req.body;
         console.log(booking);
         const result = await bookingCollection.insertOne(booking);
         res.send(result);
    })
    // update operation started 
    app.patch('/bookings/:id', async(req,res)=>{
      const updateBooking = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id)};
      const options = { upsert: true };
      const updateBookingData = {
        $set:{
          status:updateBooking.status
        }
      }
      const result = await  bookingCollection.updateOne(filter,updateBookingData,options);
      res.send(result);
    })
    // delete operation started 
    app.delete('/bookings/:id', async(req,res)=>{
        const id = req.params.id;
        const query = { _id: new ObjectId(id)};
        const result = await bookingCollection.deleteOne(query);
        res.send(result);
    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error

  }
}
run().catch(console.dir);



app.get('/', async(req,res)=>{
    res.status(200).send({message: 'Welcome to server'});
})
app.listen(port, ()=>{
    console.log(`car doctor server is running on port: ${port}`);
})