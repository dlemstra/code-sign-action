import * as core from '@actions/core';
import { promises as fs } from 'fs';
import { exec } from 'child_process';

async function createCertificatePfx() {
    const base64Certificate = core.getInput('certificate');
    const certificate = Buffer.from(base64Certificate, 'base64');
    console.log(`Writing ${certificate.length} bytes to certificate.pfx.`);
    await fs.writeFile('./certificate.pfx', certificate);
}

function signFile(fileName: string) {
    console.log(`Signing ${fileName}.`);

    const signtool = 'C:/Program Files (x86)/Windows Kits/10/bin/10.0.17763.0/x86/signtool.exe';
    const timestampUrl = 'http://sha256timestamp.ws.symantec.com/sha256/timestamp';
    exec(`"${signtool}" sign /f certificate.pfx /tr ${timestampUrl} /td sha256 /fd sha256 ${fileName}`, (error, stdout) => {
        if (error)
            throw error;

        console.log(stdout);
    });
}

async function signFiles() {
    const folder = core.getInput('folder');
    const files = await fs.readdir(folder);
    for (let file of files) {
        if (file.endsWith('.dll'))
            signFile(`${folder}/${file}`);
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