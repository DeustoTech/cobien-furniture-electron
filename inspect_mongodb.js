import { MongoClient } from 'mongodb';

const mongoUri = "mongodb+srv://usuarioCoBien:passwordCoBien@clustercobienevents.j8ev5.mongodb.net/?retryWrites=true&w=majority&appName=ClusterCoBienEvents";
const client = new MongoClient(mongoUri);

async function run() {
  try {
    await client.connect();
    const db = client.db("LabasAppDB");
    
    // Find device CoBien1
    const device = await db.collection("devices").findOne({ device_id: "CoBien1" });
    console.log("DEVICE BEFORE:", JSON.stringify(device, null, 2));
    
    const newContacts = [
      {
        display_name: "Contacto Real 1",
        user_name: "contacto_real_1",
        image_url: ""
      },
      {
        display_name: "Contacto Real 2",
        user_name: "contacto_real_2",
        image_url: ""
      }
    ];
    
    // Update the device contacts
    await db.collection("devices").updateOne(
      { device_id: "CoBien1" },
      { 
        $set: { 
          contacts: newContacts,
          updated_at: new Date()
        } 
      },
      { upsert: true }
    );
    
    const deviceAfter = await db.collection("devices").findOne({ device_id: "CoBien1" });
    console.log("DEVICE AFTER:", JSON.stringify(deviceAfter, null, 2));
    
  } catch (err) {
    console.error("ERROR:", err);
  } finally {
    await client.close();
  }
}

run();
