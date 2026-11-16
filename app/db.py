"""MongoDB connection and GridFS bucket."""

from flask import current_app
from gridfs import GridFSBucket
from pymongo import MongoClient


def init_db(app):
    """Create the Mongo client, database handle and GridFS bucket and attach them to the app."""
    client = MongoClient(app.config["MONGO_URI"], serverSelectionTimeoutMS=5000, tz_aware=True)
    db = client[app.config["MONGO_DB"]]
    app.extensions["mongo_client"] = client
    app.extensions["mongo_db"] = db
    app.extensions["gridfs"] = GridFSBucket(db)


def get_db():
    """Return the database handle for the current app."""
    return current_app.extensions["mongo_db"]


def get_fs():
    """Return the GridFS bucket that holds every uploaded file."""
    return current_app.extensions["gridfs"]
