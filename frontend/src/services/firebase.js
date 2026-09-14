import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'

const firebaseConfig = {
  apiKey:            "AIzaSyD7m7yoWo8rlzcoQ5_RUh4mwUCp8AEJ9N8",
  authDomain:        "navisea-fe61d.firebaseapp.com",
  databaseURL:       "https://navisea-fe61d-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:         "navisea-fe61d",
  storageBucket:     "navisea-fe61d.firebasestorage.app",
  messagingSenderId: "802016658008",
  appId:             "1:802016658008:web:24f62371ed57450514002d",
}

const app = initializeApp(firebaseConfig)
export const db = getDatabase(app)
