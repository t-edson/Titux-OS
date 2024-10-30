/* Librería en Javascript para emular el comportamiento de una Shell de Linux*/
"use strict";

function TitoShellEmul(response) {
    let curCommand = "";    //Comando actual
    let curXpos = 0;        //Posición actual del cursor con respecto al comando actual
    let modeShell = 0;      //Modo de trabajo del shell
    let prompt = '$ ';
    let user_list = [];     //Lista de usuarios
    let group_list = [];     //Lista de grupos
    let log_user  = '';     //Usuario actual
    let log_pass  = '';
    let log_group = '';     //Grupo actual
    let cur_path  = '';     //Ruta del directorio actual
    let cur_dir = [];       //Directorio actual
    
    let fsystem_dir = [];   //Directorio raiz del sistema de archivos
    let err = "";           //Mensaje de error
    //Modos de trabajo del Shell
    const SM_LOGIN = 0;     //Modo esperando usuario
    const SM_PASSW = 1;     //Modo esperando contraseña
    const SM_COMMAND = 2;   //Modo esperando comando
    //Variables para secuencias de escape
    let escape_mode = 0;        //Bandera para el modo escape: 
                                //  0->Normal; 1->Escape mode
    let ansi = new CAnsiEscape(executeSeq); //Lexer para secuencias ANSI.
    function executeSeq(escape_type, escape_seq) {
        /* Ejecuta la secuencia de escape capturada e inicia el procesamiento de una
        nueva secuencia */
        if (escape_type == ESC_CSI) {  //Secuencias "CSI"
            if (escape_seq == "\x1B[D") {      //Direccional izquierda
                //Verificamos la posición de nuestro cursor de comando
                if (curXpos>0) {
                    curXpos--;  //Retrocedemos
                    response(escape_seq);   //Movemos cursor en el terminal
                }
            } else if (escape_seq == "\x1B[C") {      //Direccional derecha
                //Verificamos la posición de nuestro cursor de comando
                if (curXpos < curCommand.length) {
                    curXpos++;  //Avanzamos
                    response(escape_seq);   //Movemos cursor en el terminal
                }
            } else {
                console.log("Secuencia CSI no identificada en el shell: " + escape_seq);
            }
        } else {
            console.log("Secuencia no identificada en el shell" + escape_seq);
        }
        //Inicia nueva secuencia
        escape_mode = 0;    //Termina secuencia.
    }
    function processEnter() {
        /* Procesa la tecla <Enter>. Normalmente será para la ejecución de un comando. */
        if (modeShell==SM_LOGIN) {
            log_user = curCommand;
            //Pasa a modo contraseña
            curCommand = '';
            curXpos = 0;
            modeShell=SM_PASSW;
            response('Password: ');
        } else if (modeShell==SM_PASSW) {
            //Valida la contraseña
            log_pass = curCommand; 
            if (log_user in user_list && log_pass==user_list[log_user][0]) {
                //Pasa a modo comando
                modeShell=SM_COMMAND;
                log_group = user_list[log_user][1];     //Lee grupo
                let last_login = new Date().toGMTString(); 
                response('Last login: ' + last_login + " from tty1\n");
                response(prompt);
            } else {
                response("Login incorrect.\n\n");
                modeShell = SM_LOGIN;   //Modo de inicio de sesión
                response('Login: ');
            }
            curCommand = '';
            curXpos = 0;
        } else if (modeShell==SM_COMMAND) {
            err = "";
            let parts = curCommand.split(/\s+/);
            let command = parts[0];
            if (command =='') {
            } else if (command=='date') {
                let cur_date = new Date().toGMTString(); 
                response(cur_date + "\n");
            } else if (command=='pwd') {
                if (cur_path=='') response("/\n"); 
                else response(cur_path + "\n");
            } else if (command=='ls') {
                do_ls(parts);
            } else if (command=='cd') {
                do_cd(parts);
            } else{
                err = "Command not found";
            }
            if (err!="") response(curCommand + ": " + err + "\n");
            curCommand = '';
            curXpos = 0;
            response(prompt);
        } else {
            curCommand = '';
            curXpos = 0;
            response('$');
        }
    }
    function writeCode(keycode) {
        /** Recibe un código de caracter */
        let c = String.fromCharCode(keycode);
        if (escape_mode==0) {   //Modo normal
            //Verifica si es <Enter>
            if (keycode==10) {  //0X0A -> "\n"
                response(c); //Genera el eco
                processEnter();
            } else if (keycode==8) {   //Backspace
                if (curXpos>0) {
                    //Elimina el caracter a la izquierda del comando
                    curCommand = curCommand.slice(0, curXpos-1) + curCommand.slice(curXpos);
                    curXpos--;  //Actualiza cursor del sistema
                    //response("\n"+curCommand)
                    response("\x08");   //Responde para eliminar del terminal. "\x1B[P"
                }
            } else if (keycode==27) {   //Caracter "ESC"
                //Inicia una secuencia de escape
                escape_mode = 1;        //Activa modo de escape
                ansi.init(c);
            } else {
                if (modeShell != SM_PASSW) {
                    response(c); //Genera el eco
                }
                //Es una tecla cualquiera
                curCommand = curCommand + c;  //Acumula cadena
                curXpos = curXpos + 1;
            }
        } else {    //En modo ESCAPE 
            ansi.putchar(c);    //Lo procesa el lexer
        }
    }
    function write(str) {
        /** Recibe un flujo de texto, por el canal Stdin */
        for (let i = 0; i < str.length; i++) {
            let keyCode = str.charCodeAt(i);
            shell.writeCode(keyCode);
        }
    }
    function expandFiles(fname, fdir) {
        /*Expande un nombre de archivo con comodines (fname) en una lista de archivos, 
        de acuerdo a la lista de archivos que existan en la lista "fdir".
        Devuelve la lista de archivos en una lista  con los archivos que cumplen el 
        patrón.*/
        let flist = {};
        if (/[\*\?]/.test(fname)) { //Contiene caracteres comodín
            //Hay que expandir
            const regex = new RegExp(fname.replace(/\?/g, '.').replace(/\*/g, '.*')); // Convierte comodines a una expresión regular
            for (const clave in fdir) {
                if (regex.test(clave)) { // Verificar si la clave coincide con el patrón
                    flist[clave] = fdir[clave]; // Copiar al nuevo diccionario
                }
            }            
        } else {    //No contiene caracteres comodín
            for (const clave in fdir) {
                if (clave==fname) { // Verificar si existe
                    flist[clave] = fdir[clave]; // Copiar al nuevo diccionario
                }
            }            
        }
        return flist;
    }
    function expand_rel_path(basepath, rel_path) {
        /* Expande la ruta relativa "rel_path" y devuelve una ruta absoluta. 
        "basepath" no debe incluir el caracter "/" al final */
        if (rel_path[0]=='/') { //Es absoluta
            return rel_path;
        } else {
            return basepath + "/" + rel_path;
        }
    }
    function do_cd(parts) {
        /*Accede al directorio indicado */
        let path = parts[1]; 
        if (path=='/') {
            cur_path = '';
            cur_dir = fsystem_dir;
            return;
        }
        let new_path = expand_rel_path(cur_path, path);
        let dirs = new_path.split('/');
        //Verifica si existe la ruta absoluta
        let next_dir = fsystem_dir;
        for (let i = 1; i < dirs.length; i++) {
            if (dirs[i] in next_dir) {
                next_dir = next_dir[dirs[i]][6];   //Toma la lista del directorio
                if (typeof next_dir === 'string') {  //Es un archivo
                    err = dirs[i] + ": Not a directory";
                    return;
                }
            } else {
                err = 'No such file or directory';
                return;
            }
        }
        //Existe. Actualiza cur_path.
        cur_path = new_path;
        cur_dir = next_dir;
    }
    function do_ls(parts) {
        /**Hace un listado del directorio actual */
        function list_columns(fnames, maxlen, totlen) {
            let ncols = Math.floor(80/maxlen);  //Calcula número de columnas para el listado
            let nlins = Math.ceil(fnames.length/ncols);  //Filas por columna
            if (ncols>=fnames.length || totlen<=80) {    //Se puede listar en una sola fila
                for (let i = 0; i < fnames.length; i++) {
                    response(fnames[i] + "  ");
                }
                response("\n")
            } else {    //Se debe listar en varias filas
                //response("ncols=" + ncols + "\n");
                //response("nlins=" + nlins + "\n");
                //response("maxlen=" + maxlen + "\n");
                //Lista por filas
                for (let fil = 0; fil < nlins; fil++) {
                    //Escribe por columnas
                    for (let col = 0; col < ncols; col++) {
                        let i = col*nlins+fil;
                        if (i<fnames.length) {
                            let f_name = fnames[i].padEnd(maxlen);
                            response(f_name);
                        }
                    }
                    response("\n")
                }
            }
        }
        function list_details(the_dir) {
                const opc = { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false };
                const fecActual = new Date();
                for (let key in the_dir) {
                    let fdat = the_dir[key];
                    //Da formato a fecha
                    let fmod = fdat[5];
                    const fecFormat = fmod.toLocaleString('en-US', opc);   //"Mar 07, 2023, 03:22"
                    const parts = fecFormat.split(', ');
                    let fecShort;
                    if (fmod.getFullYear() === fecActual.getFullYear()) {
                        fecShort = parts[0] + ' ' + parts[2];
                    } else {
                        fecShort = parts[0] + '  ' + parts[1];
                    };
                    response(fdat[0] + " " + 
                        String(fdat[1]).padStart(3) + " "  +  //Permisos
                        fdat[2].padEnd(8) + " " +       //Usuario
                        fdat[3].padEnd(8) + " " +       //Grupo
                        String(fdat[4]).padStart(6) + " " +   //Tamaño
                        fecShort + " " +   //Fecha
                        key +  "\n");
                }                
        }
        let match_dir = [];  //Directorio de archivos que cumplen
        //Busca si hay nombre de archivo
        let fname = '';
        for (let i = 1; i < parts.length; i++) {
            let par = parts[i].trim();  //Parámetro
            if (par[0]!='-') fname = par;
        }
        //Filtra lista de archivos por nombre
        if (fname=='') {
            if (parts.includes('-a')) {  //Sin filtro
                match_dir = cur_dir;  
            } else {  //Filtrando archivos ocultos
                for (const fname in cur_dir) {
                    if (fname[0]!=".") match_dir[fname] = cur_dir[fname];
                }
            }
        } else {
            //Hay que buscar los que cumplan
            /*Por simplicidad, aquí asumimos que "fname" no contiene información del
            directorio, sino tan solo el nombre. */
            match_dir = expandFiles(fname, cur_dir);   //Archivos que cumplen
        }
        //Lista el directorio "match_dir"
        let maxlen = 0;    //Tamaño máximo de los nombres de los archivos
        let totlen = 0;    //Tamaño total del nombre de los archivos 
        for (let f_name in match_dir) {   //Calcula el tamaño máximo de los nombres
            totlen += f_name.length + 2;
            if (f_name.length>maxlen) maxlen = f_name.length;
        }
        maxlen += 2;        //Aumenta dos caracteres para dejar espacio
        totlen -= 2;        //Corrige quitando espacio al último
        let fnames = Object.keys(match_dir);  //Para poder iterar sobre los archivos
        if (fnames.length==0) return;   //No hay archivos
        if (parts.includes('-l')) list_details(match_dir); 
        else list_columns(fnames, maxlen, totlen);
    }
    function do_getdir(path) {
        /* Devuelve el directorio "path" en una lista o diccionario. */
        if (path=="/") {    //Directorio raiz
            return fsystem_dir;
        } else { //Hay que buscar el directorio
            let next_dir = {};
            if (path[0] == '/') {   //Ruta absoluta
                let dirs = path.split('/');
                next_dir = fsystem_dir;   //DIrectorio inicial
                for (let i = 0; i < dirs.length; i++) {
                    if (dirs[i] in next_dir) {
                        next_dir = next_dir[6];  //Toma la lista de directorio
                    } else {
                        err = 'No such file or directory';
                        return next_dir;
                    }
                }
                return next_dir;
            } else {    //Ruta relativa
                err = 'Invalid path';
                ////// Completar
            }
        }
    }
    function do_mkdir(dir_name) {
        /* Crea un nuevo directorio, en el directorio actual.*/
        //Verifica si existe ya el nombre.
        if (dir_name in cur_dir) {
            err = "Cannot create directory '" + dir_name + "': File exists";
            return;
        }
        //Creamos el nuevo  directorio
        let new_dir = [];
        //Creamos la entrada del directorio
        cur_dir[dir_name] = ['drwxr-xr-x', 1, log_user, log_group, 4096, new Date(), new_dir];
        /* Una carpeta de archivos es una lista con el nombre del archivo como clave.
        Los archivos se definen como una lista con los siguientes campos:
            - Permisos del archico,
            - Número de enlaces
            - Propietario del archivo
            - Grupo al que pertenece
            - Tamaño del archivo en bytes
            - Fecha y hora de la última modificación
            - Contenido del archivo, si es un archivo, o lista de archivos si es una carpeta.
        */
        //Crea los directorios del sistema
        new_dir['.']  = ['drwxr-xr-x', 1, log_user, log_group, 4096, new Date(), new_dir];
        new_dir['..'] = ['drwxr-xr-x', 1, log_user, log_group, 4096, new Date(), null];  //Formalmente deberían tener el usuario y grupo del directorio padre
    }
    function init_filesystem() {
        //filesystem = new Array(NROWS);  
        //Inicia creación de directorios
        log_user = 'root';
        log_group = 'root';
        cur_path = "";  //Directorio raiz
        cur_dir = fsystem_dir;
        do_mkdir(".");
        do_mkdir("..");
        do_mkdir("bin");
        do_mkdir("dev");  
        do_mkdir("lib");  
        do_mkdir('home');
        fsystem_dir["usr123456789012"]   = ['-rwxrwxrwx', 1, 'usuario', 'grupo', 4096, new Date("2024/01/28 01:20:00"), "Hola mundo"];  
        fsystem_dir["camino.xml"]        = ['-rwxrwxrwx', 1, 'usuario', 'grupo', 4096, new Date("2024/01/27 05:00:00"), "Hola mundo"];  
        fsystem_dir["programa"]          = ['-rwxrwxrwx', 1, 'usuario', 'grupo', 4096, new Date("2024/01/15 01:00:00"), "Hola mundo"];  
        fsystem_dir["nombre_algo_largo"] = ['-rwxrwxrwx', 1, 'usuario', 'grupo', 4096, new Date("2024/10/13 01:30:00"), "Hola mundo"];  
        do_mkdir('root');
        fsystem_dir["prueba.txt"]        = ['-rwxrwxrwx', 1, 'usuario', 'grupo', 4096, new Date("2024/10/27 01:05:00"), "Hola mundo"];  
    }
    function init() {
        /* Inicializa el emulador del Sistema Operativo e inicia el modo de inicio de
         sesión */
        curCommand = "";
        curXpos = 0;
        //Cre grupos
        group_list['root'] = 'root';  //Crea un grupo
        group_list['user'] = 'user';  //Crea un grupo
        //Crea usuarios
        user_list['root'] = ['root', 'root'];     //[clave, grupo]
        user_list['user'] = ['user', 'user'];     //[clave, grupo]
        //Mensaje de saludo
        response("\n");
        response("Titux OS System. Javascript Linux Emulator.\n");
        response("Kernel 0.0.2-Educational-version.\n");
        response("\n");
        ////////////// Prueba de control de pantalla //////////////
//        response("\x1B[5;5fTexto en (5,5)");
//        response("\x1B[5;14f");
//        response("\x1B[1J");
//        response("\x1B[s");
//        response("\x1B[u");

//        response("\x1B[1mTexto en negrita\n");
//        response("\x1B[0;4mTexto subrayado\n");
//        response("\x1B[0;7mTexto en negativo\n");
//        
//        response("\x1B[0;90mTexto en negro\n");
//        response("\x1B[0;91mTexto en rojo\n");
//        response("\x1B[0;92mTexto en verde\n");
//        response("\x1B[0;93mTexto en amarillo\n");
//        response("\x1B[0;94mTexto en azul\n");
//        response("\x1B[0;95mTexto en magenta\n");
//        response("\x1B[0;96mTexto en cian\n");
//        response("\x1B[0;97mTexto en blanco\n");
//
//        response("\x1B[0;39mTexto en color normal\n");
//
        //////////////////////////////////////////////////////////
        init_filesystem();
//        modeShell = SM_LOGIN;   //Modo de inicio de sesión
        modeShell = SM_COMMAND;   //Modo de comandos
        log_user = 'root';
        log_group = 'root';

        response("\x1B[0m");    //Restaura atributos
        response('Login: ');
    }
    //Métodos públicos
    this.write = function(str) {write(str)};
    this.writeCode = function(keycode) {writeCode(keycode)};
    this.init = function () {init()};
}
