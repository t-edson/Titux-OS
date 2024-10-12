/* Librería en Javascript para emular el comportamiento de una Shell de Linux*/
"use strict";

function TitoShellEmul(response) {
    let curCommand = "";    //Comando actual
    let curXpos = 0;        //Posición actual del cursor con respecto al comando actual
    let modeShell = 0;      //Modo de trabajo del shell
    let prompt = '$ ';
    let user_list = [];
    let log_user;
    let log_pass;
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
            let pwd = user_list[log_user];
            if (log_user in user_list && log_pass==pwd) {
                //Pasa a modo comando
                let last_login = new Date().toGMTString(); 
                response('Last login: ' + last_login + " from tty1\n");
                modeShell=SM_COMMAND;
                response(prompt);
            } else {
                response("Login incorrect.\n\n");
                modeShell = SM_LOGIN;   //Modo de inicio de sesión
                response('Login: ');
            }
            curCommand = '';
            curXpos = 0;
        } else if (modeShell==SM_COMMAND) {
            if (curCommand=='date') {
                let cur_date = new Date().toGMTString(); 
                response(cur_date + "\n")
            } else {
                response(curCommand + ": Command not found\n")
            }
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
    function init() {
        /* Inicializa el emulador del Sistema Operativo e inicia el modo de inicio de
         sesión */
        curCommand = "";
        curXpos = 0;
        user_list['root'] = 'root'; //Crea al usuario root
        //Mensaje de saludo
        response("\n");
        response("Titux OS System. Javascript Linux Emulator.\n");
        response("Kernel 0.0.1-Educational-version.\n");
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
//        response("\x1B[0;40mTexto con Fondo negro\n");
//        response("\x1B[0;41mTexto con Fondo rojo\n");
//        response("\x1B[0;42mTexto con Fondo verde\n");
//        response("\x1B[0;43mTexto con Fondo amarillo\n");
//        response("\x1B[0;44mTexto con Fondo azul\n");
//        response("\x1B[0;45mTexto con Fondo magenta\n");
//        response("\x1B[0;46mTexto con Fondo cian\n");
//        response("\x1B[0;47mTexto con Fondo blanco\n");
//
//        response("\x1B[0;49mTexto con Fondo normal\n");
//
//        response("\x1B[38;2;190;130;0mTexto con color RGB\n");
//
//        response("\x1B[38;5;11mTexto con color de 8 bits\n");
//        response("\x1B[48;5;3mTexto con fondo de 8 bits\n");
//        response("\x1B[0m\x1B[38;5;21mTexto con color RGB de 8 bits\n");  //Azul
//        response("\x1B[0m\x1B[38;5;46mTexto con color RGB de 8 bits\n");  //Verde
//        response("\x1B[0m\x1B[38;5;196mTexto con color RGB de 8 bits\n");  //Rojo
//
//        response("\x1B[0m\x1B[38;5;255m");  //Prepara para escala de grises
//        response("\x1B[48;5;232mTexto con gris de 8 bits\n");
//        response("\x1B[48;5;236mTexto con gris de 8 bits\n");
//        response("\x1B[48;5;240mTexto con gris de 8 bits\n");
//        response("\x1B[48;5;244mTexto con gris de 8 bits\n");
//        response("\x1B[48;5;248mTexto con gris de 8 bits\n");
//        response("\x1B[48;5;252mTexto con gris de 8 bits\n");


//        response("\n");
//        #Paleta de colores
//        for((i=16; i<256; i++)); 
//        do printf "\e[48;5;${i}m%03d" $i; 
//        printf '\e[0m'; 
//        [ ! $((($i - 15) % 6)) -eq 0 ] && printf ' ' || printf '\n' 
//        done

        //////////////////////////////////////////////////////////
        modeShell = SM_LOGIN;   //Modo de inicio de sesión
        response("\x1B[0m");    //Restaura atributos
        response('Login: ');

    }
    //Métodos públicos
    this.write = function(str) {write(str)};
    this.writeCode = function(keycode) {writeCode(keycode)};
    this.init = function () {init()};
}
