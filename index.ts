import * as core from '@actions/core';
import { promises as fs } from 'fs';
import { existsSync, createWriteStream } from 'fs';
import https from 'https';
import path from 'path';
import util from 'util';
import { exec } from 'child_process';
import { env } from 'process';

const asyncExec = util.promisify(exec);
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
    const base64Certificate = core.getInput('certificate', { required: true }).replace(/(-+)(BEGIN|END)( CERTIFICATE)(-+)/g, '');
    const certificate = Buffer.from(base64Certificate, 'base64');
    if (certificate.length == 0)
        throw 'certificate value is not set.';
    const certificateFileName = env['TEMP'] + `\\code-sign-certificate-${Math.floor((Math.random() * 1000000))}.pfx`
    console.log(`Writing ${certificate.length} bytes to ${certificateFileName}.`);
    await fs.writeFile(certificateFileName, certificate);
    return certificateFileName;
}

async function removeCertificatePfx(certificateFileName: string | null) {
    if (certificateFileName === null)
        return;
    console.log(`Removing ${certificateFileName}.`);
    await fs.unlink(certificateFileName);
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

async function signWithSigntool(signtool: string, certificateFileName: string, certificatePassword: string, fileName: string) {
    try {
        let command = `"${signtool}" sign /f ${certificateFileName} `;
        if (certificatePassword !== '') {
            command += `/p "${certificatePassword}" `
        }
        command += `/tr ${timestampUrl} /td sha256 /fd sha256 "${fileName}"`;

        const { stdout } = await asyncExec(command);
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

async function signNupkg(certificateFileName: string, certificatePassword: string, fileName: string) {
    await downloadNuGet();

    try {
        let command = `"${nugetFileName}" sign "${fileName}" -Timestamper ${timestampUrl} -CertificatePath ${certificateFileName}`;
        if (certificatePassword !== '') {
            command += ` -CertificatePassword "${certificatePassword}"`
        }

        const { stdout } = await asyncExec(command);
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

async function trySignFile(signtool: string, certificateFileName: string, certificatePassword: string, fileName: string) {
    console.log(`Signing: ${fileName}.`);
    const extension = path.extname(fileName);
    for (let i=0; i< 10; i++) {
        await sleep(i);
        if (signtoolFileExtensions.includes(extension)) {
            if (await signWithSigntool(signtool, certificateFileName, certificatePassword, fileName))
                return;
        } else if (extension == '.nupkg') {
            if (await signNupkg(certificateFileName, certificatePassword, fileName))
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
    let fileName = 'unable to find signtool.exe';
    let maxVersion = 0;
    for (const folder of folders) {
        if (!folder.endsWith('.0')) {
            continue;
        }
        const folderVersion = parseInt(folder.replace(/\./g,''));
        if (folderVersion > maxVersion) {
            const signtoolFilename = `${windowsKitsfolder}${folder}/x64/signtool.exe`;
            try {
                const stat = await fs.stat(signtoolFilename);
                if (stat.isFile()) {
                    fileName = signtoolFilename
                    maxVersion = folderVersion;
                }
            }
            catch {
            }
        }
    }

    console.log(`Signtool location is ${fileName}.`);

    return fileName;
}

async function signFiles(certificateFileName: string) {
    const certificatePassword = core.getInput('password');
    const signtool = await getSigntoolLocation()

    const folder = core.getInput('folder');
    if (folder !== '') {
        const recursive = core.getInput('recursive') == 'true';
        for await (const file of getFiles(folder, recursive)) {
            await trySignFile(signtool, certificateFileName, certificatePassword, file);
        }
    } else {
        const files = core.getMultilineInput('files');
        if (files.length === 0)
            core.setFailed(`Either folder or files should be specified`);
        for (const file of files) {
            await trySignFile(signtool, certificateFileName, certificatePassword, file);
        }
    }
}

async function run() {
    let certificateFileName = null;
    try {
        certificateFileName = await createCertificatePfx();
        if (certificateFileName !== null)
            await signFiles(certificateFileName);
        await removeCertificatePfx(certificateFileName);
    }
    catch (err) {
        await removeCertificatePfx(certificateFileName);
        core.setFailed(`Action failed with error: ${err}`);
    }
}

run();
