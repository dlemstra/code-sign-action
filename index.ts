import * as core from '@actions/core';
import { promises as fs } from 'fs';

async function createCertificatePfx() {
    const base64Certificate = core.getInput('certificate');
    const certificate = Buffer.from(base64Certificate, 'base64');
    console.log(`Writing ${certificate.length} bytes to certificate.pfx.`);
    await fs.writeFile('./certificate.pfx', certificate);
}

async function signFile(file: string) {
    console.log(file);
}

async function signFiles() {
    const folder = core.getInput('folder');
    const files = await fs.readdir(folder);
    for (let file of files) {
        if (file.endsWith('.dll'))
            await signFile(`${folder}/file`);
    }
}

async function run() {
    try {
        await createCertificatePfx();
        await signFiles();
    }
    catch (err) {
        core.setFailed(`Action failed with error ${err}`);
    }
}

run();