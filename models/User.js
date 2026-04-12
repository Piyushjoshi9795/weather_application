
const mongoose= require('mongoose');
const bcrypt=require('bcrypt');

const userSchema = new mongoose.Schema({
    username:{
        type:String,
        required : true,
        unique : true,
        trim : true, // removes accidental spaces
        minlength :3,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true, // always store emails in lowercase
        trim: true,   
    },
    password: {
        type: String,
        required: true,
        minlength: 6,

    },
   // Store refresh tokens here so we can revoke them
  // (a user can be logged in on multiple devices)
  refreshTokens: [String]
    }
,{ timestamps: true }); // adds createdAt, updatedAt automatically

// BEFORE saving to DB, hash the password
// This is a Mongoose "pre-save hook"
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;

  this.password = await bcrypt.hash(this.password, 10);
});

// Method to compare entered password with hashed password in DB
userSchema.methods.comparePassword =async function(enteredPassword){
    return await bcrypt.compare(enteredPassword,this.password);
};

module.exports=mongoose.model('User',userSchema);