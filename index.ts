import * as core from '@actions/core';
import { promises as fs } from 'fs';
import util from 'util';
import { exec } from 'child_process';

const asyncExec = util.promisify(exec);

function sleep(seconds: number) {
    if (seconds > 0)
        console.log(`Waiting for ${seconds} seconds.`);
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

async function createCertificatePfx() {
    const base64Certificate = core.getInput('certificate');
    const certificate = Buffer.from(base64Certificate, 'base64');
    if (certificate.length == 0)
        throw 'certificate value is not set.';
    console.log(`Writing ${certificate.length} bytes to certificate.pfx.`);
    await fs.writeFile('./certificate.pfx', certificate);
}

async function signFile(fileName: string) {
    const signtool = 'C:/Program Files (x86)/Windows Kits/10/bin/10.0.17763.0/x86/signtool.exe';
    const timestampUrl = 'http://timestamp.digicert.com';

    try {
        const { stdout } = await asyncExec(`"${signtool}" sign /f certificate.pfx /tr ${timestampUrl} /td sha256 /fd sha256 ${fileName}`);
        console.log(stdout);
        return true;
    } catch(err) {
        console.log(err.stderr);
        return false;
    }
}

async function trySignFile(fileName: string) {
    console.log(`Signing ${fileName}.`);
    for (let i=0; i< 10; i++) {
        await sleep(i);
        if (await signFile(fileName))
            return;
    }
    throw `failed to sign '${fileName}'`;
}

async function signFiles() {
    const folder = core.getInput('folder');
    const files = await fs.readdir(folder);
    for (let file of files) {
        if (file.endsWith('.dll')) {
            await trySignFile(`${folder}/${file}`);
        }
    }
}

async function run() {
    try {
        await createCertificatePfx();
        await signFiles();
    }
    catch (err) {
        core.setFailed(`Action failed with error: ${err}`);
    }
}

run();
