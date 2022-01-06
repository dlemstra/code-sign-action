import * as core from '@actions/core';
import { promises as fs } from 'fs';
import { existsSync, createWriteStream } from 'fs';
import https from 'https';
import path from 'path';
import util from 'util';
import { exec } from 'child_process';
import { env } from 'process';

const asyncExec = util.promisify(exec);
const certificateFileName = env['TEMP'] + '\\certificate.pfx';
const nugetFileName = env['TEMP'] + '\\nuget.exe';

const timestampUrl = 'http://timestamp.digicert.com';

const signtoolFileExtensions = [
    '.dll', '.exe', '.sys', '.vxd',
    '.msix', '.msixbundle', '.appx',
    '.appxbundle', '.msi', '.msp',
    '.msm', '.cab', '.ps1', '.psm1'
];

interface IExecException
{
    stdout: string
    stderr: string
}

function isExecException(err: unknown): err is IExecException  {
    return (err as IExecException).stdout !== undefined && 
        typeof (err as IExecException).stdout === 'string' &&
        (err as IExecException).stderr !== undefined && 
        typeof (err as IExecException).stderr === 'string';
}

function sleep(seconds: number) {
    if (seconds > 0)
        console.log(`Waiting for ${seconds} seconds.`);
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

async function createCertificatePfx() {
    const base64Certificate = core.getInput('certificate');
    const certificate = Buffer.from(base64Certificate, 'base64');
    if (certificate.length == 0) {
        console.log('The value for "certificate" is not set.');
        return false;
    }
    console.log(`Writing ${certificate.length} bytes to ${certificateFileName}.`);
    await fs.writeFile(certificateFileName, certificate);
    return true;
}

async function downloadNuGet() {
    return new Promise<void>(resolve => {
        if (existsSync(nugetFileName)) {
            resolve();
            return;
        }

        console.log(`Downloading nuget.exe.`);

        const file = createWriteStream(nugetFileName);
        https.get('https://dist.nuget.org/win-x86-commandline/latest/nuget.exe', (response) => {
            response.pipe(file);
            file.on('finish', function() {
                file.close();
                resolve();
            });
        });
    });
}

async function signWithSigntool(signtool: string, fileName: string) {
    try {
        const { stdout } = await asyncExec(`"${signtool}" sign /f ${certificateFileName} /tr ${timestampUrl} /td sha256 /fd sha256 ${fileName}`);
        console.log(stdout);
        return true;
    } catch(err: unknown) {
        if (isExecException(err)) {
            console.log(err.stdout);
            console.log(err.stderr);
        }
        return false;
    }
}

async function signNupkg(fileName: string) {
    await downloadNuGet();

    try {
        const { stdout } = await asyncExec(`"${nugetFileName}" sign ${fileName} -CertificatePath ${certificateFileName} -Timestamper ${timestampUrl}`);
        console.log(stdout);
        return true;
    } catch(err: unknown){
        if (isExecException(err)) {
            console.log(err.stdout);
            console.log(err.stderr);
        }
        return false;
    }
}

async function trySignFile(signtool: string, fileName: string) {
    console.log(`Signing ${fileName}.`);
    const extension = path.extname(fileName);
    for (let i=0; i< 10; i++) {
        await sleep(i);
        if (signtoolFileExtensions.includes(extension)) {
            if (await signWithSigntool(signtool, fileName))
                return;
        } else if (extension == '.nupkg') {
            if (await signNupkg(fileName))
                return;
        }
    }
    throw `Failed to sign '${fileName}'.`;
}

async function* getFiles(folder: string, recursive: boolean): AsyncGenerator<string> {
    const files = await fs.readdir(folder);
    for (const file of files) {
        const fullPath = `${folder}/${file}`;
        const stat = await fs.stat(fullPath);
        if (stat.isFile()) {
            const extension = path.extname(file);
            if (signtoolFileExtensions.includes(extension) || extension == '.nupkg')
                yield fullPath;
        }
        else if (stat.isDirectory() && recursive) {
            yield* getFiles(fullPath, recursive);
        }
    }
}

async function getSigntoolLocation() {
    const windowsKitsfolder = 'C:/Program Files (x86)/Windows Kits/10/bin/';
    const folders = await fs.readdir(windowsKitsfolder);
    let fileName = '';
    let maxVersion = 0;
    for (const folder of folders) {
        if (!folder.endsWith('.0')) {
            continue;
        }
        const folderVersion = parseInt(folder.replace('.',''));
        if (folderVersion > maxVersion) {
            fileName = `${windowsKitsfolder}/${folder}/x86/signtool.exe`
            maxVersion = folderVersion;
        }
    }

    console.log(`Signtool location is ${fileName}.`);

    return fileName;
}

async function signFiles() {
    const folder = core.getInput('folder', { required: true });
    const recursive = core.getInput('recursive') == 'true';
    const signtool = await getSigntoolLocation()
    for await (const file of getFiles(folder, recursive)) {
        await trySignFile(signtool, file);
    }
}

async function run() {
    try {
        if (await createCertificatePfx())
            await signFiles();
    }
    catch (err) {
        core.setFailed(`Action failed with error: ${err}`);
    }
}

run();
