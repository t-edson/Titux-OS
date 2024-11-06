/* Librería en Javascript para emular el comportamiento de una Shell de Linux.
            Por Tito Hinostroza
Referencias:
https://www.fpgenred.es/GNU-Linux/expansin_del_shell.html
*/
"use strict";
/* Clase que define a un archivo o carpeta. Todos los archivos o carpetas se representan
como uno de estos objetos. Las carpetas usan el contenedor "this.dir" como un diccionario
de objetos Cfile. */
class Cfile {
    perm  = '-rwxrwxrwx';
    links = 1;
    constructor(name, perm, owner, group, size, parent) {
        this.name   = name;         //Nombre del archivo
        this.perm   = perm;         //Permisos del archico
        this.links  = 1;            //Número de enlaces
        this.owner  = owner;        //Propietario del archivo
        this.group  = group;        //Grupo al que pertenece
        this.size   = size;         //Tamaño del archivo en bytes
        this.mdate  = new Date();   //Fecha y hora de la última modificación
        this.content= '';           //Contenido del archivo, cuando es un archivo
        this.dir    = [];           //Lista de archivos cuando es una carpeta
        this.parent = parent;       //Directorio padre (objeto Cfile)
    }
    isFile() {
        return (this.perm[0] == '-');
    }
    isDir() {
        return (this.perm[0] == 'd');
    }
    isRoot() {
        return (this.parent == null);
    }
}
/* Clase principal que define al shell */
function TitoShellEmul(response) {
    let curCommand = "";    //Comando actual
    let curXpos = 0;        //Posición actual del cursor con respecto al comando actual
    let modeShell = 0;      //Modo de trabajo del shell
    let hostname = 'pc';    //Nombre del equipo
    let prompt = '[\\u@\\h \\W]\$ ';
    let user_list = [];     //Lista de usuarios
    let group_list = [];     //Lista de grupos
    let log_user  = '';     //Usuario actual
    let log_pass  = '';
    let log_group = '';     //Grupo actual
    //SIstema de archivos
    let root_dir = null;    //Directorio raiz
    let cur_path  = '';     //Ruta del directorio actual
    let cur_dir = null;     //Directorio actual
    
    let err = '';           //Mensaje de error
    //Modos de trabajo del Shell
    const SM_LOGIN = 0;     //Modo esperando usuario
    const SM_PASSW = 1;     //Modo esperando contraseña
    const SM_COMMAND = 2;   //Modo esperando comando
    //Variables para secuencias de escape
    let escape_mode = 0;        //Bandera para el modo escape: 
                                //  0->Normal; 1->Escape mode
    let ansi = new CAnsiEscape(executeSeq); //Lexer para secuencias ANSI.
    //Manejo de errores
    function clearStderr() {
        //Limpia los errores
        err = '';
    }
    function addError(msg) {
        //Agrega un error al "stderror".
        if (err=='') err = msg; 
        else err += "\n" + err;
    }
    function sendStderror(command) {
        //Muestra el mensaje por el terminal
        response(command + ": " + err + "\n");        
    }
    //Funciones de archivo
    function expandFileNameIn(file_arr, fname, base_dir, hides) {
        /* Expande un nombre de archivo (o carpeta) con comodines (cadena "fname"), y
        agrega al arreglo "file_arr". Si el nombre de archivo "fname" incluye comodines,
        expande la lista de acuerdo a los archivos que existan en el direct. "base_dir"
        (que representa al directorio actual).
        La bandera "hides" indica si se deben incluir archivos ocultos.
        No se validan que todos los nombres devueltos existan como archivos o carpetas de
        "base_dir". */
        if (fname=='*') {   //Todos los archivos de "base_dir"
            if (hides) {    //Incluye todos
                file_arr.push(...Object.keys(base_dir.dir));  //Agrega todos
            } else {        //No ocultos
                for (const clave in base_dir.dir) {
                    if (clave[0]!='.') file_arr.push(clave);
                }            
            }
        } else if (/[\*\?]/.test(fname)) { //Contiene caracteres comodín
            //Hay que expandir.
            let path = '';
            if (fname.includes('/')) {  //Incluye información de ruta
                //Obtiene ruta y nombre de archivo
                let path_a = fname.split('/')
                fname = path_a.pop();
                path = path_a.join('/');
                //if (path.includes('*') || path.includes('?')) { //No soportamos rutas con comodín
                //    addError('Invalid path: ' + path);
                //    return;
                //}
                //Actualiza nueva ruta base 
                base_dir = get_file_from(path, base_dir);
                if (err!='') return;
                path += '/';   //Prepara para concatenar
            }
            //Crea una expresión regular equivalente a los comodines
            const regex = new RegExp('^'+fname.replace(/\?/g, '.').replace(/\*/g, '.*')+'$'); 
            //Soporte a comodines *, ? y []
            //const escapa = (caracter) => `\\${caracter}`;
            //const regex =new RegExp('^' + patron
            //    .replace(/([.?*+^$[\]\\(){}|-])/g, escapa) // Escapa caracteres especiales de regex
            //    .replace(/\?/g, '.')                     // ? se convierte en cualquier carácter
            //    .replace(/\*/g, '.*')                    // * se convierte en cero o más caracteres
            //    .replace(/\[([^\]]+)\]/g, '[$1]')        // Soporta los corchetes
            //    + '$')
            //Busca archivos que coincidan con el patrón
            for (const clave in base_dir.dir) {
                if (!hides && clave[0]=='.') continue;
                if (regex.test(clave)) {    //Verificar si la clave coincide con el patrón
                    file_arr.push(path + clave);      //Agrega al arreglo
                }
            }            
        } else {    //No contiene caracteres comodín
            file_arr.push(fname); //Solo lo agrega al arreglo
        }
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
    function get_path(obj_fil) {
        /* Devuelve la ruta al archivo o la carpeta. El parámetro "obj_file" debe ser un
        objeto "Cfile" que represente a un archivo o carpeta. */
        let path = '';
        while (obj_fil.parent!=null) {
            path = '/' + obj_fil.name + path;
            obj_fil = obj_fil.parent;
        }
        return path;
    }
    function get_file_from(path, base_dir) {
        /* Devuelve un objeto Cfile a partir de la cadena "path" y del directorio base
        "base_dir". El parámetro "path" puede tener una ruta relativa o absoluta. Si la
        ruta del archivo es absoluta, se ignora el directorio base.
        El objeto devuelto puede ser un archivo o directorio. Si no puede ubicar al 
        archivo destino, devuelve NULL y genera error en "stderror".*/
        if (path=='/') {
            return root_dir;
        }
        //Prepara exploración a través de la ruta
        let next_dir;
        let dirs = path.split('/');
        if (path[0]=='/') {
            next_dir = root_dir;
            dirs.shift();   //Quita directorio vacío
        } else {
            next_dir = base_dir;
        }
        //Explora por el árbol de directorios a partir de "next_dir".
        for (let i = 0; i < dirs.length; i++) {
            if (next_dir.isFile()) {  //Es un archivo. No podemos seguir avanzando.
                addError(next_dir.name + ": Not a directory");
                return null;
            }
            let dirname = dirs[i];
            if (dirname == '') {    //Puede ser el último directorio o uno vacío
                continue;
            } else if (dirname == '.') {
                continue;
            } else if (dirname == '..') {  //Directorio padre
                if (next_dir.parent!=null) {
                    next_dir = next_dir.parent;
                }
            } else if (dirname in next_dir.dir) {
                next_dir = next_dir.dir[dirname];    //Nuevo directorio
            } else {
                addError(dirname + ': No such file or directory');
                return null;
            }
        }
        return next_dir;
    }
    function validate_params(pars, fnames, perms) {
        /* Valida que los parámetros ingresados, en el arreglo "pars", estén en la lista
        de parámetros permitidos "perms" y extrae los nombres que no son parámetros en 
        "fnames". Si no se reconoce un parámetro, se genera un error.
        Los parámetros se reconocen porque empiezan con "-"
        */
        for (let i = 1; i < pars.length; i++) { //No considera nombre del comando
            let par = pars[i];  //Parámetro
            if (par[0]=='-') {
                par = par.slice(1);   //quita "-"
                if (perms.includes(par)) {
                    //verb = true; OK
                } else {
                    addError("invalid option -- '" + par + "'");
                    return;
                }
            } else {
                fnames.push(par);  //Agrega nombre
            }
       }
    }
    function mkdir(base_dir, dir_name) {
        /* Crea un nuevo directorio, en el directorio indicado (base_fil). Devuelve la 
        referencia al directorio creado. */
        //Verifica si existe ya el nombre.
        if (dir_name in base_dir.dir) {
            addError("Cannot create directory '" + dir_name + "': File exists");
            return;
        }
        //Creamos el nuevo directorio
        let new_dir = new Cfile(dir_name, 'drwxr-xr-x', log_user, log_group, 4096, base_dir);
        //Creamos la entrada del directorio
        base_dir.dir[dir_name] = new_dir;
        //Crea los directorios del sistema
        new_dir.dir['.']  =  new Cfile('.', 'drwxr-xr-x', log_user, log_group, 4096, new_dir);
        new_dir.dir['..'] =  new Cfile('..','drwxr-xr-x', base_dir.owner, base_dir.group, 4096, new_dir);
        //Actualiza diccionario de directorios
        new_dir.dir['.'].dir  = new_dir.dir;
        new_dir.dir['..'].dir = base_dir.dir;
        return new_dir;
    }
    function mkfile(base_dir, fil_name, mdate, content) {
        /* Crea un nuevo directorio, en el directorio indicado (base_fil). Devuelve la 
        referencia al archivo creado. */
        //Verifica si existe ya el nombre.
        if (fil_name in base_dir.dir) {
            addError("Cannot create file '" + fil_name + "': File exists");
            return;
        }
        //Creamos el nuevo archivo
        let new_fil = new Cfile(fil_name, '-rwxr-xr-x', log_user, log_group, content.length, base_dir);
        new_fil.mdate = mdate;
        new_fil.content = content;
        //Creamos la entrada del directorio
        base_dir.dir[fil_name] = new_fil;
        return new_fil;
    }
    function do_cd(pars) {
        /*Accede al directorio indicado */
        if (pars.length==1) return;  //Sin parámetros
        let path = pars[1]; 
        let new_dir = get_file_from(path, cur_dir);
        if (err != '') return;
        if (new_dir.isFile()) {  //Terminó en un archivo
            addError(new_dir.name + ": Not a directory");
            return;
        }
        //Existe. Actualiza cur_path.
        cur_dir = new_dir;
        cur_path = get_path(cur_dir);
    }
    function do_echo(pars) {
        if (pars.length == 1) return;   //Sin parámetros
        let args = Array.from(pars);    //Copia antes de modificar
        args.shift();     //Deja solo parámetros
        //Busca parametros solo al inicio, como parece trabajar "echo".
        let nextln = true;
        while (args.length>0 && (args[0]=='-n' /*|| ... */)) {
            if (args[0]=='-n') nextln = false;
            args.shift();
        }
        //Imprime parámetros
        if (nextln) response(args.join(' ') + "\n");
        else response(args.join(' '));
    }
    function do_mkdir(pars) {
        /* Crea un directorio en el directorio actual o en el indicado. */
        let fnames = [];    //Nombres de archivos (o carpetas) indicados.
        validate_params(pars, fnames, ['v']);
        if (err!='') return;
        if (fnames.length==0) {   
            addError("missing operand");
            return;
        }
        //Banderas
        let verb = pars.includes('-v');   //Bandera de archivos ocultos

        //Crea los diectorios indicados
        for (const dirname of fnames) {
            let abspath = expand_rel_path(cur_path, dirname);
            let dirs = abspath.split('/');
            //Valida al directorio padre
            let newdir = dirs.pop();
            let parent = get_file_from(dirs.join('/'), cur_dir);
            if (err!='') return;    //No lo ubica
            if (parent.isFile()) {  //Terminó en un archivo
                addError(parent.name + ": Not a directory");
                return;
            }
            //Crea al directorio
            mkdir(parent, newdir);
            if (verb) response("mkdir: created directory '" + dirname + "'\n");
        }
    }
    function do_rmdir(pars) {
        /* Elimina un directorio en el directorio actual o en el indicado. */
        let fnames = [];    //Nombres de archivos (o carpetas) indicados.
        validate_params(pars, fnames, ['v']);
        if (err!='') return;
        if (fnames.length==0) {   
            addError("missing operand");
            return;
        }
        //Banderas
        let verb = pars.includes('-v');   //Bandera de archivos ocultos
        
        //Elimina los diectorios indicados
        for (const dirname of fnames) {
            let abspath = expand_rel_path(cur_path, dirname);
            //Valida al directorio padre
            let target = get_file_from(abspath, cur_dir);
            if (err!='') return;    //No lo ubica
            if (target.isFile()) {  //Es un archivo
                addError(target.name + ": Not a directory");
                return;
            }
            if (Object.keys(target.dir).length>2) {  //No está vacío
                addError("failed to remove '" + target.name + "': Directory not empty");
                return;
            }
            //Elimina el directorio
            if (verb) response("rmdir: removing directory '" + dirname + "'\n");
            let parent = target.parent;
            delete parent.dir[target.name];
        }
    }
    function do_ls(pars) {
        const SCR_WIDTH = 80;
        /**Hace un listado del directorio actual */
        function list_columns(file_arr) {
            /* Lista los archivos que hay en file_arr[]. */
            if (file_arr.length==0) return;   //No hay archivos
            let maxlen = 0;    //Tamaño máximo de los nombres de los archivos
            let totlen = 0;    //Tamaño total del nombre de los archivos 
            for (let fil of file_arr) {   //Calcula el tamaño máximo de los nombres
                totlen += fil.name.length + 2;
                if (fil.name.length>maxlen) maxlen = fil.name.length;
            }
            maxlen += 2;        //Aumenta dos caracteres para dejar espacio
            totlen -= 2;        //Corrige quitando espacio al último
    
            let ncols = Math.floor(SCR_WIDTH/maxlen);   //Calcula número de columnas para el listado
            let nlins = Math.ceil(file_arr.length/ncols); //Filas por columna
            if (ncols>=file_arr.length || totlen<=SCR_WIDTH) {    //Se puede listar en una sola fila
                for (let fil of file_arr) {
                    response(fil.name + "  ");
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
                        if (i<file_arr.length) {
                            let f_name = file_arr[i].name.padEnd(maxlen);
                            response(f_name);
                        }
                    }
                    response("\n")
                }
            }
        }
        function list_details(file_arr) {
            /* Lista el detalle de los archivos que hay en file_arr[]. */
            const opc = { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false };
            const fecActual = new Date();
            for (let fdat of file_arr) {
                //Da formato a fecha
                let fmod = fdat.mdate;
                const fecFormat = fmod.toLocaleString('en-US', opc);   //"Mar 07, 2023, 03:22"
                const parts = fecFormat.split(', ');
                let fecShort;
                if (fmod.getFullYear() === fecActual.getFullYear()) {
                    fecShort = parts[0] + ' ' + parts[2];
                } else {
                    fecShort = parts[0] + '  ' + parts[1];
                };
                response(fdat.perm + " " + 
                    String(fdat.links).padStart(3) + " "  +  //Enlaces
                    fdat.owner.padEnd(8) + " " +       //Usuario
                    fdat.group.padEnd(8) + " " +       //Grupo
                    String(fdat.size).padStart(6) + " " +   //Tamaño
                    fecShort + " " +   //Fecha
                    fdat.name +  "\n");
            }                
        }
        function list_files(file_arr, detail, sortmt, sortmtR, sorsiz, sorsizR) {
            if (sortmt) {   //Ordenar por fecha. Recientes primero
                file_arr.sort((a, b) => new Date(b.mdate) - new Date(a.mdate));
            } else if (sortmtR) {   //Ordenar por fecha.
                file_arr.sort((a, b) => new Date(a.mdate) - new Date(b.mdate));
            } else if (sorsiz) {   //Ordenar por tamaño. Grandes primero
                file_arr.sort((a, b) => new Date(b.size) - new Date(a.size));
            } else if (sorsizR) {   //Ordenar por tamaño.
                file_arr.sort((a, b) => new Date(a.size) - new Date(b.size));
            }
            if (detail) {
                list_details(file_arr);
            } else {
                list_columns(file_arr);
            }
        }
        function sep_fil_dir(file_arr, dirfil, files, dirs, base_dir) {
        /* Recibe un arreglo de nombres de archivos o directorios y separa esta lista en 
        dos arreglos de objetos Cfile: Una para archivos (files), y otra para directorios
        (dirs). La separación está condicionada a la bandera "dirfil".
        Además, valida existencia de archivos (generando error si es necesario) de modo 
        que todos los archivos devueltos en "files" o "dirs" existen en "dir_list".
        */
            for (let fname of file_arr) {
                let file = get_file_from(fname, base_dir);
                if (err!='') return;
                //Separa cuando aplique
                if (dirfil) {   //No separa
                    files.push(file);
                } else {    //Separa
                    if (file.isFile()) {
                        files.push(file);
                    } else {
                        dirs.push(file);
                    }
                }
            }
        }
        function addAllNamesIn(files, hides, dir_list) {
            /* Lee todos los nombres, de archivos o directorios, de la lista "dir_list". */
            if (hides) {  //Sin filtro
                files.push(...Object.values(dir_list));  //Agrega todos
            } else {  //Filtrando archivos ocultos
                for (const fname in dir_list) {
                    if (fname[0]!=".") files.push(dir_list[fname]);
                }
            }
        }
        let file_arr = [];  //Lista de archivos que cumplen
        //Busca si se ha indicado nombre de archivo
        let fnames = [];    //Nombres de archivos (o carpetas) indicados.
        validate_params(pars, fnames, ['a','v','l','d','t','tr','S','Sr']);
        if (err!='') return;
        //Filtra lista de archivos por nombre
        let hides = pars.includes('-a');   //Bandera de archivos ocultos
        let detail = pars.includes('-l');  //Bandera de lista detallada
        let dirfil = pars.includes('-d');  //Directorio como archivos
        let sortmt = pars.includes('-t');  //Ordenar por fecha de modificación
        let sortmtR = pars.includes('-tr');  //Ordenar por fecha de modificación en reversa
        let sorsiz = pars.includes('-S');  //Ordenar por tamaño
        let sorsizR = pars.includes('-Sr');  //Ordenar por tamaño en reversa
        if (fnames.length==0) fnames.push('.');    //No se ha indicado nombres. Se asume ".".
        //Hace la expansión de los nombres de archivos proporcionados
        for (let i = 0; i < fnames.length; i++) {
            expandFileNameIn(file_arr, fnames[i], cur_dir, hides);   //Archivos que cumplen
        }
        //Valida existencia de archivos y separa en archivos y carpetas de ser necesario
        let files = []; //Arreglo de archivos (Cfile)
        let dirs  = []; //Arreglo de directorios (Cfile)
        sep_fil_dir(file_arr, dirfil, files, dirs, cur_dir);
        if (err!='') return;
        //Lista en columnas o detalle
        if (dirfil) {  //Listar directorios sin expandir
            //Lista los archivos que están en "files".
            list_files(files, detail, sortmt, sortmtR, sorsiz, sorsizR);
        } else {  //Los directorios deben listarse expandidos al final
            //Luego los de los directorios
            if (files.length==0 && dirs.length==1) {   //Solo hay un directorio
                //Listamos ese directorio. 
                addAllNamesIn(files, hides, dirs[0].dir);
                list_files(files, detail, sortmt, sortmtR, sorsiz, sorsizR);
            } else {    //Hay más de un directorio
                //Primero lista los archivos.
                list_files(files, detail, sortmt, sortmtR, sorsiz, sorsizR);
                if (dirs.length>0) response("\n");  //Separador
                //Lista directorios
                for (const dname of dirs) {
                    response(dname.name + ":\n");
                    addAllNamesIn(files, hides, dname.dir);
                    list_files(files, detail, sortmt, sortmtR, sorsiz, sorsizR);
                }
            }
        }
    }
    function do_whoami(pars) {
        let fnames = [];    //Nombres de archivos (o carpetas) indicados.
        validate_params(pars, fnames, []);
        if (err!='') return;
        //Muestra usuario
        response(log_user + "\n");
    }
    function do_hostname(pars) {
        let fnames = [];    //Nombres de archivos (o carpetas) indicados.
        validate_params(pars, fnames, []);
        if (err!='') return;
        //Muestra nombre de pc
        response(hostname + "\n");
    }
    function do_help(pars) {
        response("Titux OS System. Pure Javascript Linux Emulator.\n");
        response("Kernel 0.0.3-Educational-version. Created by Tito Hinostroza.\n");
        response("The entire emulator is running locally on your PC, without remote connection.\n");
        response("The file system can be manipulated, but the state will be restored when you refresh the browser. ");
        response("There is no support for redirects, pipes or permissions. \n");
        response("Only a few commands are implemented:\n");
        response("\n");
        response("cd [dir name]\n");
        response("date\n");
        response("echo [-n] [arg ...]\n");
        response("help\n");
        response("hostname\n");
        response("ls [files] [-a] [-d] [-l] [-t[r]] [-S[r]]\n");
        response("mkdir [dir names] [-v]\n");
        response("rmdir [dir names] [-v]\n");
        response("pwd\n");
        response("whoami\n");
    }
    function init_filesystem() {
        //Crea la raiz
        root_dir = new Cfile('/', 'drwxr-xr-x', 'root', 'root', 4096, null);
        //Inicia creación de directorios
        log_user = 'root';
        log_group = 'root';
        cur_path = "";  //Directorio raiz
        cur_dir = root_dir;
        //Crea directorios del sistema
        cur_dir.dir['.']  =  new Cfile('.', 'drwxr-xr-x', log_user, log_group, 4096, cur_dir);
        cur_dir.dir['..'] =  new Cfile('..','drwxr-xr-x', log_user, log_group, 4096, cur_dir);
        cur_dir.dir['.'].dir  = cur_dir.dir;    //Actualiza diccionario de directorios
        cur_dir.dir['..'].dir = cur_dir.dir;    //Actualiza diccionario de directorios
        mkdir(cur_dir, "bin");
        mkdir(cur_dir, "dev");  
        mkdir(cur_dir, "etc");  
        let home_dir = mkdir(cur_dir, 'home');
        mkdir(home_dir, 'root');    //Directorio /home/root

        mkdir(cur_dir, "lib");  
        mkdir(cur_dir, "root");
        mkdir(cur_dir, "usr");
        mkdir(cur_dir, "aaa");
        mkfile(cur_dir, "aaa.txt"         , new Date("2024/01/28 01:20:00"), "Hola");
        mkfile(cur_dir, "bbb.txt"         , new Date("2024/01/27 05:00:00"), "Hola mundo");  
        mkfile(cur_dir, "nombre_algo_largo",new Date("2024/10/13 01:30:00"), "a");  
        mkfile(cur_dir, "test.txt"        , new Date("2023/10/27 01:05:00"), "Hola mundo");  
        //Crea carpeta de usuario
        log_user = 'user';
        log_group = 'user';
        let user_dir = mkdir(home_dir, 'user');
        mkdir(user_dir, 'Desktop');
        mkdir(user_dir, 'Documents');
        mkdir(user_dir, 'Downloads');
        mkdir(user_dir, 'Music');
        mkdir(user_dir, 'Pictures');
        mkdir(user_dir, 'Public');
        mkdir(user_dir, 'Videos');
        mkfile(user_dir, "a.txt"           , new Date("2024/01/28 01:20:00"), "Hola");
        mkfile(user_dir, "b.txt"           , new Date("2024/01/27 05:00:00"), "Hola mundo");  
    }
    //Procesamiento de entrada
    function sendPrompt() {
        /* Muestra el prompt por el terminal */
        let tmp = prompt.replace('\\u', log_user)
        .replace('\\h', hostname)
        .replace('\\W', cur_path);
        response(tmp);
    }
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
    function getParameters(command) {
        /* Divide la cadena "command" en tokens separados por espacios. Los tokens 
        delimitados por comillas se consideran como un solo token. */
        if (command.trim()=='') {
            return [''];    //Devuelve un solo elemento vacío
        } else {
            const regex = /"([^"]+)"|\S+/g; // Captura texto entre comillas o palabras no espaciadas
            //Elimina las comillas
            return command.match(regex).map(token => token.replace(/(^"|"$)/g, '')); 
        }
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
                do_cd(['','/home/'+log_user]);
                let last_login = new Date().toGMTString(); 
                response('Last login: ' + last_login + " from tty1\n");
                sendPrompt();
            } else {
                response("Login incorrect.\n\n");
                modeShell = SM_LOGIN;   //Modo de inicio de sesión
                response('Login: ');
            }
            curCommand = '';
            curXpos = 0;
        } else if (modeShell==SM_COMMAND) {
            clearStderr();
            let pars = getParameters(curCommand.trim());
            let command = pars[0];
            if (command =='') {
            } else if (command=='date') {
                let cur_date = new Date().toGMTString(); 
                response(cur_date + "\n");
            } else if (command=='pwd') {
                if (cur_path=='') response("/\n"); 
                else response(cur_path + "\n");
            } else if (command=='ls') {
                do_ls(pars);
            } else if (command=='cd') {
                do_cd(pars);
            } else if (command=='echo') {
                do_echo(pars);
            } else if (command=='mkdir') {
                do_mkdir(pars);
            } else if (command=='rmdir') {
                do_rmdir(pars);
            } else if (command=='whoami') {
                do_whoami(pars);
            } else if (command=='hostname') {
                do_hostname(pars);
            } else if (command=='help') {
                do_help(pars);
            } else{
                addError("Command not found");
            }
            if (err!="") sendStderror(command);
            curCommand = '';
            curXpos = 0;
            sendPrompt();
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
        response("Kernel 0.0.3-Educational-version.\n");
        response("\n");
        ////////////// Prueba de control de pantalla //////////////
//        response("\x1B[5;5fTexto en (5,5)");
//        response("\x1B[5;14f");
//        response("\x1B[1J");
//        response("\x1B[s");
//        response("\x1B[u");
        //////////////////////////////////////////////////////////
        init_filesystem();
        modeShell = SM_LOGIN;   //Modo de inicio de sesión

//        modeShell = SM_COMMAND;   //Modo de comandos
//        log_user = 'root';
//        log_group = 'root';

        response("\x1B[0m");    //Restaura atributos
        response('Login: ');
    }
    //Métodos públicos
    this.write = function(str) {write(str)};
    this.writeCode = function(keycode) {writeCode(keycode)};
    this.init = function () {init()};
}
