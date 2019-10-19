import * as core from '@actions/core';

async function run() {
    try {
        const base64Certificate = core.getInput('certificate');
        const certificate = Buffer.from(base64Certificate, 'base64');
        console.log(certificate.length);
    }
    catch (err) {
        core.setFailed(`Action failed with error ${err}`);
    }
}

run();