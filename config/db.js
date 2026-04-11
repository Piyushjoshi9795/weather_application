const mongoose=require('mongoose');


const connectDB= async ()=>{
    try {
        const conn= await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    }
    catch (err)
    {
        console.error('Error connecting to MongoDB:', err);
        process.exit(1); // stop the server if DB fails — no point running without it
    }
}

module.exports=connectDB;