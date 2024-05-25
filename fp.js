#!/usr/bin/env node

"use strict"

import path from "path";
import fs from "fs";
import zlib from "zlib";
import { Transform } from "stream";

import * as caf from "caf";
import * as minimist from "minimist";

const CAF = caf.CAF;

const __dirname = import.meta.dirname;

const args = minimist.default(process.argv.slice(2), {
    // overwite the default types allowing for easier commands.
    boolean: [ "help", "in", "out", "uncompress", "compress", ],
    string: [ "file", "outfile"]
});

const TIMEOUT_LENGTH = 100;

// Configure a base file path. it should be __dirname or the environment variable.
const BASE_PATH = path.resolve(process.env.BASE_PATH || __dirname);
// ^^ this lets us call the command with an environment variable like this:
// BASE_PATH=files/ ./fp.js --file=hello.txt
// ^^ this creates an environment variable just for the ./fp.js command

let OUT_FILENAME = "out.txt";
let OUT_PATH = path.join(BASE_PATH, OUT_FILENAME);

// Wrap process file in Cancelable Async Flow. This will give us access
// to methods that allow us to cancel or timeout async methods.
processFile = CAF(processFile);

// Handle our arguments.
if (args.outfile) { // overwrite OUT_FILENAME
    OUT_PATH = path.join(BASE_PATH, args.outfile);
}

if (args.help || process.argv.length <= 2) {
    error(null, /*showHelp=*/true);
}
else if (args._.includes("-") || args.in) { // handle stdin
    let tooLong = CAF.timeout(TIMEOUT_LENGTH); // cancellation token
    processFile(tooLong, process.stdin).catch(error);
}
else if (args.file) { // handle file command
    let filepath = path.join(BASE_PATH, args.file);
    let tooLong = CAF.timeout(TIMEOUT_LENGTH, "Took too long!"); // cancellation token

    processFile(tooLong, fs.createReadStream(filepath))
        .then(() => {
            // do something after the stream
            console.log("Complete!");
        })
        .catch(error);
}
else {
    error("Usage incorrect.", /*showHelp=*/true);
}

// ************************************

function printHelp() {
    console.log("ex3 usage:");
    console.log("");
    console.log("--help                      print this help");
    console.log("-, --in                     read file from stdin");
    console.log("--file={FILENAME}           read file from {FILENAME}");
    console.log("--uncompress                uncompress input file with gzip");
    console.log("--compress                  compress output with gzip");
    console.log("--out                       print output");
    console.log("");
    console.log("");
}

// Our Error handling function that lets us send an exit code along with
// the option to show our help menu with a list of commands. 
function error(err, showHelp = false) {
    process.exitCode = 1;
    console.error(err || "");
    if (showHelp) {
        console.log("");
        printHelp();
    }
}

// Signal our end stream event. This will allow us end the stream early
// if run into an error or timeout.
function streamComplete(stream) {
    return new Promise((res) => {
        stream.on("end", res); // Call res to signal that the stream has reached its end event.
    });
}

function compress(stream) {
    OUT_PATH = `${OUT_PATH}.gz`;
    // Pipe a new gzip object into our stream.
    return stream.pipe(zlib.createGzip());
}

function uncompress(stream) {
    // Pipe a new gunzip object into our stream.
    return stream.pipe(zlib.createGunzip());
}

function toUpperCaseTransform() {
    // Create a transform stream where we can manipulate the data of
    // each chunk and convert it to uppercase.
    return new Transform({
        transform(chunk, encoding, callback) {
            // This is where we can mkae changes to the data within
            // the stream if we want to.

            // The stream works like an array so we can put a chunk
            // into the stream using this.push(). However, this.push()
            // will turn the string back into a buffer and prevents
            // unnecessary memory usage.
            this.push(chunk.toString().toUpperCase());
            callback(); // notify end of chunk
        }
    })
}

// Since streams are async we need to make processFile let us know
// once the stream is finished. We can do this by making processFile
// async and treating it like a promise.

// Another way to handle notifying when the stream completes is with
// generators. This will also let write cancellation and timeouts.
function *processFile(signal, inputStream) {
    let stream = inputStream; // Stream from stdin.
    let outStream; // Since we input a readstream, this is our writestream output.

    // The uncompress arg needs to happen before we do any transforms.
    if (args.uncompress) {
        stream = uncompress(stream);
    }

    // Transform the data in our stream to uppercase. We can add a
    // few different transforms here if we want. We just have to
    // remember to assign them back to our outStream each time.
    let upperCaseTr = toUpperCaseTransform();

    // Pipe our uppercase stream into our stream. We are assigning
    // our transform stream to save the updated data.
    stream = stream.pipe(upperCaseTr);

    // Handle the commands/args vv

    if (args.compress) {
        stream = compress(stream);
    }

    if (args.out) { // print the stream to stdout or write the stream to a file.
        outStream = process.stdout; 
    }
    else {
        outStream = fs.createWriteStream(OUT_PATH);
    }
    
    // Handle closing the stream vv

    // Pipe out outstream to our current stream.
    stream.pipe(outStream);

    // Signal to tell the stream to stop.
    signal.pr.catch(() => {
        // stop sending more chunks / remove event listener.
        stream.unpipe(outStream);
        // don't do anymore work, optionally throw an error.
        stream.destroy();
    });

    // Signal that our stream is done.
    yield streamComplete(stream);
}