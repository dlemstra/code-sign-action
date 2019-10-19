import * as core from '@actions/core';
import { promises as fs } from 'fs';

async function run() {
    try {
        const base64Certificate = core.getInput('certificate');
        const certificate = Buffer.from(base64Certificate, 'base64');
        console.log(`Writing ${certificate.length} bytes to certificate.pfx.`);
        await fs.writeFile('./certificate.pfx', certificate);
    }
    catch (err) {
        core.setFailed(`Action failed with error ${err}`);
    }
}

run();