import mongoose from "mongoose";
const { Schema } = mongoose;

const DocumentSchema = new Schema({
  _id: String,
  data: Object,
});

const Document = mongoose.model("Document", DocumentSchema);

export default Document;
