function buf2base64(buffer) {
    let binary = '';
    for (let i = 0; i < buffer.byteLength; i++) {
        binary += String.fromCharCode(buffer[i]);
    }
    return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base642buf(base64) {
    let binary = window.atob(base64.replace(/\-/g, '+').replace(/\_/g, '/'));
    let bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

async function encrypt(plaintext, password, iv) {
    try {
        let alg = { name: 'AES-GCM', iv: iv };
        let key = await crypto.subtle.importKey('raw', password, alg, false, ['encrypt']);
        let ciphertext = await crypto.subtle.encrypt(alg, key, new TextEncoder().encode(plaintext));
        return ciphertext;
    }
    catch(err) {
        error('encrypt-error-block');
    }
}

async function decrypt(ciphertext, password, iv) {
    try {
        let alg = { name: 'AES-GCM', iv: iv };
        let key = await crypto.subtle.importKey('raw', password, alg, false, ['decrypt']);
        let plaintext = await crypto.subtle.decrypt(alg, key, ciphertext);
        return new TextDecoder().decode(plaintext);
    }
    catch(err) {
        error('decrypt-error-block');
    }
}

async function create() {
    let plaintext = document.getElementById('secret-message').value;
    if (plaintext) {
        let password = crypto.getRandomValues(new Uint8Array(32));
        let iv = crypto.getRandomValues(new Uint8Array(12));
        var ciphertext = await encrypt(plaintext, password, iv);
        if (ciphertext) {
            let xhr = new XMLHttpRequest;
            xhr.open('PUT', '/put/' + buf2base64(iv), true);
            xhr.onload = async function () {
                if (xhr.readyState == 4) {
                    switch (xhr.status) {
                        case 201:
                            value('shared-link', xhr.getResponseHeader('Location'));
                            value('decryption-key', buf2base64(password));
                            value('quick-link', xhr.getResponseHeader('Location') + '#' + buf2base64(password));
                            text('expire-time', '(' + new Date(Date.now() + 24*60*60*1000) + ')');
                            show('share-block');
                            hide('create-block');
                            break;
                        default:
                            error('create-error-block');
                    }
                }
            }
            xhr.send(ciphertext);
        }
    }
    else {
        error('encrypt-error-block');
        document.getElementById('secret-message').select();
    }
}

var ciphertext = '';

async function read() {
    if (ciphertext) {
        let password = document.getElementById('decryption-key').value
        if (password.length == 43) {
            password = base642buf(password);
            let iv = base642buf(window.location.pathname.split( '/' )[1]);
            let plaintext = await decrypt(ciphertext, password, iv);
            if (plaintext) {
                value('secret-message', plaintext);
                show('read-block');
                hide('download-block');
            }
            else {
                error('decrypt-error-block');
                show('decryption-key-block');
                hide('quick-link-header');
                document.getElementById('decryption-key').select();
            }
        }
        else {
            error('decrypt-error-block');
            show('decryption-key-block');
            hide('quick-link-header');
            document.getElementById('decryption-key').select();
        }
    }
    else {
        let xhr = new XMLHttpRequest;
        xhr.open('GET', '/get/' + window.location.pathname.split( '/' )[1], true);
        xhr.responseType = 'arraybuffer';
        xhr.onload = async function () {
            if (xhr.readyState == 4) {
                switch (xhr.status) {
                    case 200:
                        ciphertext = xhr.response;
                        read();
                        break;
                    case 404:
                        show('not-exist-block');
                        hide('download-block');
                        break;
                    default:
                        error('download-error-block');
                }
            }
        }
        xhr.send(null);
    }
}

async function burn(block) {
    if (document.location.pathname != '/') {
        var path = document.location.pathname;
    }
    else {
        var path = '/' + document.getElementById('shared-link').value.split('/').slice(-1)[0]
    }
    let xhr = new XMLHttpRequest;
    xhr.open('DELETE', '/delete' + path, false);
    xhr.onload = async function () {
        if (xhr.readyState == 4 ) {
            switch (xhr.status) {
                case 204:
                    show('success-burn-block');
                    hide(block);
                    break;
                case 405:
                    show('not-exist-block');
                    hide(block);
                    break;
                default:
                    error('burn-error-block');
            }
        }
    }
    xhr.send(null);
}

async function save() {
    let blob = new Blob([document.getElementById('secret-message').value]);
    let link = document.createElement("a");
    link.download = document.location.pathname;
    link.href = window.URL.createObjectURL(blob);
    try {
            link.onclick = destroy;
            link.style.display = "none";
            document.body.appendChild(link);
    }
    catch(err) {
        alert(err);
    }
    link.click();
}

function destroy(event) {
    document.body.removeChild(event.target);
}

function copy(id) {
    document.getElementById(id).select();
    document.execCommand('Copy');
}

function text(id, text){
    document.getElementById(id).innerText = text;
}

function value(id, value) {
    document.getElementById(id).value = value;
}

function show(id) {
    document.getElementById(id).style.display = 'block';
}

function hide(id) {
    document.getElementById(id).style.display = 'none';
}

function error(id) {
    document.getElementById(id).style.display = 'block';
    setTimeout(function() { document.getElementById(id).style.display = 'none' }, 3000);
}
