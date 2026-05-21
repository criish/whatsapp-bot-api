const { initAuthCreds, BufferJSON } = require('@whiskeysockets/baileys');

const COLLECTION = 'whatsapp';
const CREDS_ID = 'creds';
const KEYS_ID = 'keys';

async function useMongoAuthState(mongoClient) {
  const db = mongoClient.db();
  const collection = db.collection(COLLECTION);

  let creds = await collection.findOne({ _id: CREDS_ID }).then(doc => {
    if (doc) {
      return JSON.parse(JSON.stringify(doc.data), BufferJSON.reviver);
    }
    const newCreds = initAuthCreds();
    collection.updateOne(
      { _id: CREDS_ID },
      { $set: { data: JSON.parse(JSON.stringify(newCreds, BufferJSON.replacer)) } },
      { upsert: true }
    ).catch(() => {});
    return newCreds;
  });

  let keysCache = await collection.findOne({ _id: KEYS_ID }).then(doc => {
    if (doc) {
      const parsed = {};
      for (const [type, ids] of Object.entries(doc.data)) {
        parsed[type] = {};
        for (const [id, val] of Object.entries(ids)) {
          parsed[type][id] = val !== null
            ? JSON.parse(JSON.stringify(val), BufferJSON.reviver)
            : null;
        }
      }
      return parsed;
    }
    return {};
  });

  async function persistKeys() {
    await collection.updateOne(
      { _id: KEYS_ID },
      { $set: { data: JSON.parse(JSON.stringify(keysCache, BufferJSON.replacer)) } },
      { upsert: true }
    );
  }

  const keys = {
    get: async (type, ids) => {
      const result = {};
      const typeStore = keysCache[type] || {};
      for (const id of ids) {
        if (typeStore[id] !== undefined) {
          result[id] = typeStore[id];
        }
      }
      return result;
    },
    set: async (data) => {
      for (const [type, entries] of Object.entries(data)) {
        if (!keysCache[type]) keysCache[type] = {};
        for (const [id, value] of Object.entries(entries)) {
          if (value === null) {
            delete keysCache[type][id];
          } else {
            keysCache[type][id] = value;
          }
        }
      }
      await persistKeys();
    },
  };

  return {
    state: { creds, keys },
    saveCreds: async () => {
      await collection.updateOne(
        { _id: CREDS_ID },
        { $set: { data: JSON.parse(JSON.stringify(creds, BufferJSON.replacer)) } },
        { upsert: true }
      );
    },
  };
}

module.exports = { useMongoAuthState };
