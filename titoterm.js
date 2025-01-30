
/* Librería en Javascript para emular el comportamiento de un terminal sencillo como el VT-100*/
"use strict";
///////// Constantes globales
//const textcolor = "rgb(0,240,0)";  //Color de texto
let TEXT_COLOR = "#00E800";       //Color de texto
let BACK_COLOR = "#000000";       //Color de fondo
const FONT_NORMAL = "14px monospace";   //Estilo de texto
//Definición de la clase por su constructor
function TitoTerm(idCanvas, txtReceived) {
    ///////// Dimensiones del terminal
    const CHR_WIDTH = 8;    //Ancho del caracter
    const CHR_HEIGHT = 16;  //Alto del caracter
    var NROWS = 25      //Cantidad de filas
    var NCOLS = 80      //Cantidad de columnas
    var canvas = document.getElementById(idCanvas);
    /* El contenedor "screen" es un arreglo bidimensional de cadenas. Cada celda contiene
    una cadena de longitud fija con el formato:
              - 1 caracter que es el que se mostrará.
              - 1 caracter de atributo negrita: 0->Sin negrita, 1->Negrita
              - 1 caracter de atributo subrayado: 0->Sin subrayado, 1->Subrayado
              - 4 caracteres con el color del texto: #RRGGBB
              - 4 caracteres con el color de fondo: #RRGGBB */    
    let screen;         // Define contenedor principal del texto
    //Atributos del texto
    let textBold = "0";             //Negrita desactivado por defecto.
    let textUnder = "0";            //Subrayado desactivado por defecto.
    let textColor = TEXT_COLOR;     //Color por defecto del texto
    let backColor = BACK_COLOR;     //Color por defecto del fondo
    let textNegat = "0";            //Sin negativo por defecto
    let textItal = "0";             //Cursiva desactivada por defecto
    //Variables para secuencias de escape
    let escape_mode = 0;        //Bandera para el modo escape: 
                                //  0->Normal; 1->Escape mode
    let ansi = new CAnsiEscape(executeSeq); //Lexer para secuencias ANSI.
    //Métodos
    this.putstring  = function(str) {putstring(str)};
    this.write      = function(str) {write(str)};
    this.writeln    = function(str) {writeln(str)};
    this.drawScreen = function () {drawScreen()};
    ///////// Refresco de pantalla
    const ctx = canvas.getContext("2d");  //Contexto principal del dibujo
    function initScreen() {
    /* Prepara el entorno para el dibujo en pantalla */
        canvas.width = CHR_WIDTH * NCOLS;
        canvas.height = CHR_HEIGHT * NROWS;
        canvas.addEventListener('keydown', handleKeyDown);
        //Inicializa screen[][];
        /*Se crea un arreglo de arreglos porque Javascrip no soporta, directamente, la
        definición de arreglos multidimensionales. */
        screen = new Array(NROWS);  
        for(var i=0; i<screen.length; i++) {
            screen[i] = new Array(NCOLS);
        }
        ctx.textBaseline="top";
        // Inicializa letra
        ctx.font = FONT_NORMAL;
        ctx.fillStyle = TEXT_COLOR;   //"green";
        initCursor();
    }
    function drawChar(row, col) {
    /* Dibuja un caracter en la posición indicada. */
        let car_attr = screen[row][col];
        let c = car_attr.substr(0,1);     //Lee caracter a mostrar
        //Lee estilo de la celda.
        let textStyle = FONT_NORMAL;
        if (car_attr.substr(1,1)=="1") {    //Ve si hay caracter de negrita.
            textStyle = 'bold ' + textStyle;
        }
        let under = car_attr.substr(2,1);   //Lee caracter de subrayado
        let txtcol = car_attr.substr(3,7);    //Color del texto #RRGGBB
        let bckcol = car_attr.substr(10,7);   //Color de fondo #RRGGBB
        let italic = car_attr.substr(17,1);   //Caracter de cursiva
        if (italic=="1") {    //Ve si hay caracter de cursiva.
            textStyle = 'italic ' + textStyle;
        }
        ////////// Dibuja caracter con atributos leídos.
        const xchr = col*CHR_WIDTH;
        const ychr = row*CHR_HEIGHT;
        //Dibuja fondo
        ctx.fillStyle = bckcol;
        ctx.fillRect(xchr, ychr-2, CHR_WIDTH, CHR_HEIGHT);
        //Dibuja caracter
        ctx.font = textStyle;
        ctx.fillStyle = txtcol;
        ctx.fillText(c, xchr, ychr);
        // Dibujar subrayado
        if (under=="1") {   
            const underlineY = ychr + CHR_HEIGHT-2; //Posición vertical
            ctx.beginPath();
            ctx.moveTo(xchr, underlineY);
            ctx.lineTo(xchr + CHR_WIDTH, underlineY);
            ctx.lineWidth = 2; // Grosor de la línea
            ctx.strokeStyle = txtcol; // Color de la línea
            ctx.stroke();
        }
    }
    function drawline(row) {
    /* Dibuja todo el contenido de "screen" en el terminal. */
        ctx.fillStyle = BACK_COLOR;
        ctx.fillRect(0, row*CHR_HEIGHT-2, CHR_WIDTH * NCOLS, CHR_HEIGHT);
        ctx.fillStyle = TEXT_COLOR;
        for(var col=0; col < screen[row].length; col++) {
            drawChar(row, col);
        }
        //console.log("Refrescando línea:" + row);
    }
    function drawScreen() {
    /* Dibuja todo el contenido de "screen" en el terminal. */
        for(var row=0; row < screen.length; row++) {
            drawline(row);
        }
    };
    ///////// Manejo del cursor
    let cntCursor = 0;      //Contador para el temporizador
    let cursorOff = true;   //Bandera para controlar el parpadeo del cursor
    let curTimer = 0;       //Referencia a temporizador
    let curType  = 0;       //Forma del cursor: 0->Bloque  1->Subrayado  2->Barra
    //Coordenada donde se dibuja el cursor, y donde debe refrescarse al moverlo.
    let curX = 0        
    let curY = 0       
    function drawCursor() {
        /**Dibuja el cursor en la posición actual del cursor de pantalla */
            //Lee posición donde inicia la secuencia de parpadeo. 
            //Solo se lee al mostrar el cursor porque el apagado del cursor debe hacerse
            //en la misma posición.
            curX = ccol;
            curY = crow;
            ctx.fillStyle = TEXT_COLOR;
            if (curType == 0) {    //Bloque 
                ctx.fillRect(curX*CHR_WIDTH, curY*CHR_HEIGHT-2, CHR_WIDTH, CHR_HEIGHT);
            } else if (curType==1) {   //Subrayado
                ctx.fillRect(curX*CHR_WIDTH, (curY+1)*CHR_HEIGHT-4, CHR_WIDTH, 2);
            } else if (curType==2) {   //Barra 
                ctx.fillRect(curX*CHR_WIDTH, curY*CHR_HEIGHT-2, 2, CHR_HEIGHT);
            }
    }
    function clearCursor() {
        /** Borra el cursor en la posición en donde se dibujó. */
        //Borra el fondo
        ctx.fillStyle = BACK_COLOR;
        ctx.fillRect(curX*CHR_WIDTH, curY*CHR_HEIGHT-2, CHR_WIDTH, CHR_HEIGHT);
        //Dibuja el caracter que hay en la grilla
        ctx.fillStyle = TEXT_COLOR;
        drawChar(curY, curX);
    }
    function blinkCursor() {
        /* Rutina de parpadeo del cursor */
        if (cursorOff) {  //Cursor apagado. Lo pintamos.
            drawCursor();   //Dibuja rectángulo opaco del cursor.
            cursorOff = false;
        } else {        //Cursor encendido.
            clearCursor();
            cursorOff = true;
        }
    }
    function ticCursor() {
        /* Rutina principal del temporizador. Se usa para temporizar el parpadeo */
        cntCursor++;
        if (cntCursor>=4)  {
            blinkCursor();
            cntCursor = 0;
        }
    }
    function initCursor() {
        /** Inicia el cursor para que parpadee normalmente */
        cursorOff = true;   //Inicia como cursor apagado.
        cntCursor = 0;      //Inicia contador
        curTimer = setInterval(ticCursor, 200);
        blinkCursor();
    }
    function showCursor() {
        /* Fuerza a dibujar el cursor en la posición actual. */
        if (cursorOff) {      //Está apagado
            blinkCursor();    //Fuerza el encendido.
            cntCursor = 0;    //Reinicia temporización
        }
    }
    function hideCursor() {
        /* Fuerza a borrar el cursor en la posición donde se dibujó. */
        if (!cursorOff) {      //Está encendido
            blinkCursor();    //Fuerza el apagado.
            cntCursor = 0;    //Reinicia temporización
        }
    }
    function stopCursor() {
        /* Detiene el parpadeo del cursor */
        hideCursor();   //Aseguramos que está apagado
        clearInterval(curTimer);    //Detenemos el parpadeo
    }
    function stopCursorOn() {
        /* Detiene el parpadeo del cursor dejándolo visible*/
        showCursor();   //Aseguramos que está encendido
        clearInterval(curTimer);    //Detenemos el parpadeo
    }
    ///////// Escritura en memoria
    var crow = 0;   // Posición actual del cursor
    var ccol = 0;   // Posición actual del cursor
    let crow_tmp = 0;   //Posición temporal
    let ccol_tmp = 0;   //Posición temporal
    let scrolled = false;
    let rowChanged = false;
    function clearLine(row) {
        /* Borra el contenido de una línea */
        for(var col=0; col < NCOLS; col++) {
            /*Se escriben espacios y atributos de texto, en una sola cadena de
            caracteres */
            screen[row][col] = " " + textBold + textUnder + textColor + backColor + textItal;
        }
    }
    function deleteChar(row, posx) {
        /* Elimina un caracter en la posición indicada */
        if (posx == NCOLS-1) {  //Último caracter
            screen[row][NCOLS-1] =  " " + textBold + textUnder + textColor + backColor + textItal;
        } else if (posx < NCOLS-1) {  //Caracter intermedio
            for(var col=posx; col < NCOLS-1; col++) {  //Desplaza
                screen[row][col] = screen[row][col+1];
            }
            //Pone un espacio al final
            screen[row][NCOLS-1] =  " " + textBold + textUnder + textColor + backColor + textItal;
        }
    }
    function insertChar(row, posx) {
        /* Inserta un caracter en la posición indicada */
        if (posx == NCOLS-1) {  //Último caracter
            screen[row][NCOLS-1] =  " " + textBold + textUnder + textColor + backColor + textItal;
        } else if (posx < NCOLS-1) {  //Caracter intermedio
            for(var col=NCOLS-1; col>posx; col--) {  //Desplaza
                screen[row][col] = screen[row][col-1];
            }
            //Pone un espacio en la posición actual
            screen[row][posx] =  " " + textBold + textUnder + textColor + backColor + textItal;
        }
    }
    function insertCharN(row, posx, n) {
        /* Inserta "n" caracteres en la posición indicada */
        if (posx+n>NCOLS-1) n = NCOLS-1-posx;
        if (posx == NCOLS-1) {  //Último caracter
            screen[row][NCOLS-1] =  " " + textBold + textUnder + textColor + backColor + textItal;
        } else if (posx < NCOLS-1) {  //Caracter intermedio
            for(var col=NCOLS-1; col>=posx+n; col--) {  //Desplaza
                screen[row][col] = screen[row][col-n];
            }
            //Pone espacios en la posición actual
            for (let i = 0; i < n; i++) {
                screen[row][posx+i] =  " " + textBold + textUnder + textColor + backColor + textItal;
            } 
        }
    }
    function clearBuffer() {
    /* Borra el contenido de la pantalla */
        for(var row=0; row < screen.length; row++) {
            clearLine(row);
        }
        crow = 0;
        ccol = 0;
    }
    function copyLine(lfrom, lto) {
    /* copia los caracteres de una línea a otra */
        for (let col = 0; col < NCOLS; col++) {
            var c = screen[lfrom][col];
            screen[lto][col] = c;
        }
    }
    function scrollUp() {
    /* Hace un desplazamiento vertical hacia arriba */
        for (let row = 0; row < NROWS-1; row++) {
            copyLine(row+1, row);
        }
    }
    function nextline() {
    /* Mueve el cursor a la siguiente línea */
        ccol = 0;
        crow++;
        if (crow>=NROWS) {
            //Se sobrepasó el número de líneas
            scrollUp();
            crow--;             //Corrige.
            clearLine(crow);    //Limpia la última línea
            scrolled = true;    //Marca bandera
        } else {
            rowChanged = true;
        }
    }
    function next() {
    /* Mueve el cursor a la siguiente posición */
        ccol++;
        if (ccol>=NCOLS) {  //LLegó al final de la línea.
            nextline();
        }
    }
    function beep() {
        /* Genera una onda sinusoidal */
        var context = new AudioContext();
        var oscillator = context.createOscillator();
        oscillator.type = "sine";
        oscillator.frequency.value = 1400;
        oscillator.connect(context.destination);
        oscillator.start();
        //Retardo
        setTimeout(function () {oscillator.stop();}, 50);
    }
    function cursor_left() {
        /* Mueve el cursor una posición a la izquierda */
        if (ccol == 0) {    //Cursor al inicio de la línea
            if (crow == 0) {  //Primera línea
                //No podemos retroceder más
            } else {
                crow--;     //Retrocede a la línea anterior
                ccol = NCOLS - 1;
            }
        } else {            //Cursor en una posición intermedia de la línea
            ccol--;
        }
    }
    function cursor_right() {
        /* Mueve el cursor una posición a la derecha */
        if (ccol == NCOLS-1) {    //Cursor al final de la línea
            if (crow == NROWS-1) {  //Última línea
                //No podemos avanzar más
            } else {
                crow++;     //Avanza a la siguiente línea
                ccol = 0;
            }
        } else {            //Cursor en una posición intermedia de la línea
            ccol++;
        }
    }
    function cursor_tab() {
        /* Ponr el cursor en la siguiente posición horizontal que sea múltiplo de 8 */
        let remain = ccol % 8;
        if (remain == 0) {    //Es múltiplo de 8
            ccol += 8;
        } else {
            ccol = ccol - remain + 8; 
        }
        if (ccol>NCOLS-1) ccol = NCOLS-1;
    }
    function standardColor(idx) {
        switch (idx) {
        //Colores opacos
        case 0:	return '#000000';   //Negro 
        case 1:	return '#BB0000';   //Rojo   
        case 2:	return '#00BB00';   //Verde 
        case 3:	return '#BBBB00';   //Amarillo 
        case 4:	return '#0000BB';   //Azul 
        case 5:	return '#BB00BB';   //Magenta 
        case 6:	return '#00BBBB';   //Cian 
        case 7:	return '#BBBBBB';   //Blanco 
        }
    }
    function brightColors(idx) {
        switch (idx) {
        case 0: return '#555555';   //Negro 
        case 1: return '#FF5555';   //Rojo 
        case 2: return '#55FF55';   //Verde 
        case 3: return '#FFFF55';   //Amarillo 
        case 4: return '#5555FF';   //Azul 
        case 5: return '#FF55FF';   //Magenta 
        case 6: return '#55FFFF';   //Cian 
        case 7: return '#FFFFFF';   //Blanco 
        }
    }
    function CSITextFormat(coms) {
        /* Procesa las secuencias de formato de texto, que tienen la forma "ESC[<comandos>m" 
        No incluye los formatos extendidos de color. 
        Recibe un arreglo con los valores que representan a los comandos. */
        for (let i = 0; i < coms.length; i++) {
            const com = coms[i];
            //if (isNaN(com)) return;  Asumimos que siempre serán números
            if (com=="0") {	//Valor predeterminado 
                textBold = "0";           //Negrita desactivado por defecto.
                textUnder = "0";          //Subrayado desactivado por defecto.
                textColor = TEXT_COLOR;     //Color por defecto del texto
                backColor = BACK_COLOR;     //Color por defecto del fondo
                textItal = "0";
                textNegat = "0";
            } else if (com=="1") {	//Negrita/Brillo 
                textBold = "1";           
            } else if (com=="22") {	//Sin negrita/Brillo 
                textBold = "0";  
            } else if (com=="3") {	//Cursiva. 
                textItal = "1"; 
            } else if (com=="23") {	//Sin Cursiva. 
                textItal = "0"; 
            } else if (com=="4") {	//Subrayado 
                textUnder = "1";
            } else if (com=="24") {	//Sin subrayado 
                textUnder = "0";
            } else if (com=="7") {	//Negativa 
                textNegat = "1";
            } else if (com=="27") {	//Positivo (sin negativo) 
                textNegat = "0";
            } else if (com>=30 && com<=37) {	//Color de primer plano
                textColor = standardColor(com-30);
            } else if (com>=40 && com<=47) {	//Color de Fondo
                backColor = standardColor(com-40);
            } else if (com>=90 && com<=97) {	//Color brillante de Primer plano
                textColor = brightColors(com-90);
            } else if (com>=100 && com<=107) {	//Color brillante de Fondo
                backColor = brightColors(com-100);
            } else if (com=="39") {	    //Primer plano predeterminado
                textColor = TEXT_COLOR; 
            } else if (com=="49") {	    //Fondo predeterminado
                backColor = BACK_COLOR;
            } else {
                console.log("formato CSI desconocido:" + com)
            }
        }
    }
    function CSIExtTextColor(com0, coms) {
        if (coms.length == 5 && coms[1] == "2") {        //Modo RGB: ESC[38;2;⟨r⟩;⟨g⟩;⟨b⟩m
            let rr = Number(coms[2]).toString(16).padStart(2, '0');
            let gg = Number(coms[3]).toString(16).padStart(2, '0');
            let bb = Number(coms[4]).toString(16).padStart(2, '0');
            if (com0=="38")    //Primer plano 
                textColor = '#'+rr+gg+bb;
            else                //Color de fondo
                backColor = '#'+rr+gg+bb;
        } else if (coms.length == 3 && coms[1] == "5") {
            //Formato de colores de 8 bits: ESC[38;5;⟨n⟩m, ESC[48;5;⟨n⟩m
            let com2 = coms[2];
            if (com2>=0 && com2<=7) {   //Standard colors (as in ESC [ 30–37 m)
                if (com0=="38") textColor = standardColor(Number(com2));   //Primer plano 
                else            backColor = standardColor(Number(com2));   //Color de fondo
            } else if (com2>=8 && com2<=15) {  //High intensity colors (as in ESC [ 90–97 m)
                if (com0=="38") textColor = brightColors(com2-8);   //Primer plano 
                else            backColor = brightColors(com2-8);   //Color de fondo
            } else if (com2>=16 && com2<=231) {  //6 × 6 × 6 cube (216 colors): 
                // (n) = 16 + 36 × r + 6 × g + b (0 ≤ r, g, b ≤ 5)
                com2 = com2 - 16;   //Quita desplazamiento
                let b = com2 % 6;   //Componente BLUE en número
                com2 = (com2 - b)/6;   //Quita componente BLUE
                let g = com2 % 6;  //Componente GREEN en número
                let r = (com2 - g)/6;
                let rr = (r*50).toString(16).padStart(2, '0');
                let gg = (g*50).toString(16).padStart(2, '0');
                let bb = (b*50).toString(16).padStart(2, '0');
                if (com0=="38") textColor = '#'+rr+gg+bb;   //Primer plano 
                else            backColor = '#'+rr+gg+bb;   //Color de fondo
            } else if (com2>=232 && com2<=255) {  //Grayscale from dark to light in 24 steps
                let gray = ((com2-232) * 11).toString(16).padStart(2,'0');  //De 0 a 253
                if (com0=="38") textColor = '#' + gray + gray + gray;   //Primer plano 
                else            backColor = '#' + gray + gray + gray;   //Color de fondo
            }
        } else {
            console.log("formato CSI desconocido:" + comstr);
            return;
        }
    }
    function executeSeq(escape_type, escape_seq) {
        /* Ejecuta la secuencia de escape capturada e inicia el procesamiento de una
        nueva secuencia */
        if (escape_type == ESC_UND) {     //Secuencia no identificada
            console.log("Secuencia no identificada");
        } else if (escape_type == ESC_CSI) {  //Secuencias "CSI": "ESC ["
            let delim = escape_seq.substr(-1); 
            if (escape_seq == "\x1B[P") {      //Eliminar caracter a la izquierda
                cursor_left();
                deleteChar(crow, ccol);
            } else if (escape_seq == "\x1B[6n") {   //Pide posición del cursor
                txtReceived("\x1B["+(crow+1)+";"+(ccol+1)+"R");    //Devuelve coordenadas en cadena
            } else if (delim == "@") {   //Inserta <n> espacios "\x1B[<n>@"
                let comstr = escape_seq.substr(2, escape_seq.length-3);
                let n = comstr==""?1:Number(comstr);
                insertCharN(crow, ccol, n);
            } else if (delim == "A") {   //Cursor arriba "\x1B[nA"
                let comstr = escape_seq.substr(2, escape_seq.length-3);
                let n = comstr==""?1:Number(comstr);
                crow -= n;
                if (crow <= 0) crow = 0;
            } else if (delim == "B") {   //Cursor abajo "\x1B[nA"
                let comstr = escape_seq.substr(2, escape_seq.length-3);
                let n = comstr==""?1:Number(comstr);
                crow += n;
                if (crow >= NROWS-1) crow = NROWS-1;
            } else if (delim == "C") {   //Cursor a la derecha "\x1B[nC"
                let comstr = escape_seq.substr(2, escape_seq.length-3);
                let n = comstr==""?1:Number(comstr);
                ccol += n;
                if (ccol >= NCOLS-1) ccol = NCOLS-1;
            } else if (delim == "D") {   //Cursor a la izquierda "\x1B[nD"
                let comstr = escape_seq.substr(2, escape_seq.length-3);
                let n = comstr==""?1:Number(comstr);
                ccol -= n;
                if (ccol <= 0) ccol = 0;
            } else if (delim == "E") {   //Cursor al inicio de n lineas adelante
                let comstr = escape_seq.substr(2, escape_seq.length-3);
                let n = comstr==""?1:Number(comstr);
                crow += n;
                if (crow >= NROWS-1) crow = NROWS-1;
                ccol = 0;
            } else if (delim == "F") {   //Cursor al inicio de n lineas atrás
                let comstr = escape_seq.substr(2, escape_seq.length-3);
                let n = comstr==""?1:Number(comstr);
                crow -= n;
                if (crow <= 0) crow = 0;
                ccol = 0;
            } else if (delim == "G") {   //Cursor a la columna indicada
                let comstr = escape_seq.substr(2, escape_seq.length-3);
                let n = comstr==""?0:Number(comstr);
                ccol = n;
                if (ccol < 0) ccol = 0;
                if (ccol >= NCOLS-1) ccol = NCOLS-1;
            } else if (delim == "H" || delim == "f") {   //Posiciona Cursor: ESC[<r>;<c>H
                let comstr = escape_seq.substr(2, escape_seq.length-3);
                if (comstr=="") {   //Si no se especifica, a la primera fila y columna.
                    crow = 0; ccol = 0;
                } else {
                    let coms = comstr.split(";");
                    if (coms.length == 2) {    //Tiene dos parámetros
                        crow = coms[0]==""?0:coms[0]-1; 
                        ccol = coms[1]==""?0:coms[1]-1;
                    } else if (coms.length == 1)  {  //Un solo parámetro
                        crow = coms[0]==""?0:coms[0]-1; 
                        ccol = 0;
                    }
                    if (crow<0) crow = 0;
                    if (ccol<0) ccol = 0;
                };
            } else if (escape_seq == "\x1B[s") {   //Guarda posición del Cursor
                crow_tmp = crow;
                ccol_tmp = ccol;
            } else if (escape_seq == "\x1B[u") {   //Restaura posición del Cursor
                crow = crow_tmp;
                ccol = ccol_tmp;
            } else if (delim == "J") {   //Borra la pantalla: ESC[<n>J
                let comstr = escape_seq.substr(2, escape_seq.length-3);
                if (comstr=="0") {   //Borra desde el cursor al final
                    for(let col=ccol; col < NCOLS; col++) {
                        screen[crow][col] = " " + textBold + textUnder + textColor + backColor + textItal;
                    }
                    for(var row=crow+1; row < screen.length; row++) {
                        clearLine(row);
                    }
                } else if (comstr=="1") {   //Borra desde el cursor al inicio
                    for(var row=0; row < crow; row++) {
                        clearLine(row);
                    }
                    for(let col=0; col < ccol; col++) {
                        screen[crow][col] = " " + textBold + textUnder + textColor + backColor + textItal;
                    }
                } else {    //Borra toda la pantalla
                    clearBuffer();
                    scrolled = true;    //Marca bandera para forzar a redibujar
                };
            } else if (delim == "K") {   //Borra línea: ESC[<n>K
                let comstr = escape_seq.substr(2, escape_seq.length-3);
                if (comstr=="0") {   //Borra desde el cursor al final
                    for(let col=ccol; col < NCOLS; col++) {
                        screen[crow][col] = " " + textBold + textUnder + textColor + backColor + textItal;
                    }
                } else if (comstr=="1") {   //Borra desde el cursor al inicio
                    for(let col=0; col < ccol; col++) {
                        screen[crow][col] = " " + textBold + textUnder + textColor + backColor + textItal;
                    }
                } else {    //Borra toda la pantalla
                    clearLine(crow);
                };
            } else if (delim == "S") {   //Desplaza página, "n" líneas arriba: ESC[<n>S
                let comstr = escape_seq.substr(2, escape_seq.length-3);
                if (comstr=="") comstr = 1;
                //Desplaza
                for (let row = 0; row < NROWS-comstr; row++) {
                    copyLine(row+comstr, row);
                }
                //Limpia las líneas finales
                for (let row = NROWS-comstr; row < NROWS; row++) {
                    clearLine(crow);
                }
            } else if (delim == "T") {   //Desplaza página, "n" líneas abajo: ESC[<n>T
                let comstr = escape_seq.substr(2, escape_seq.length-3);
                if (comstr=="") comstr = 1;
                //Desplaza
                for (let row = NROWS-1; row >= comstr; row--) {
                    copyLine(row-comstr, row);
                }
                //Limpia las líneas iniciales
                for (let row = 0; row < comstr; row++) {
                    clearLine(row);
                }
            } else if (delim == "d") {   //Posiciona Cursor verticalmente: ESC[<r>d
                let comstr = escape_seq.substr(2, escape_seq.length-3);
                if (comstr=="") {   //Si no se especifica, a la primera fila y columna.
                    crow = 0;
                } else {
                    crow = comstr-1; 
                    if (crow<0) crow = 0;
                };
            } else if (delim == "m") {   //Formato de texto
                //Basado en https://learn.microsoft.com/es-es/windows/console/console-virtual-terminal-sequences
                //Se toman los mismos colores del Putty.
                let comstr = escape_seq.substr(2, escape_seq.length-3);
                let coms = comstr.split(";");
                let coms0 = coms[0];
                if (coms0 == "38" || coms0 == "48") {        //Modo extendido 
                    CSIExtTextColor(coms0, coms)
                } else {    //Debe ser el modo normal
                    CSITextFormat(coms);
                }
            //Algunas secuencias privadas
            } else if (escape_seq == "\x1B[?12h") {   //Habilita parpadeo del cursor
                initCursor();
            } else if (escape_seq == "\x1B[?12l") {   //Deshabilita parpadeo del cursor
                clearInterval(curTimer);    
            } else if (escape_seq == "\x1B[?25h") {   //Muestra cursor
                initCursor();
            } else if (escape_seq == "\x1B[?25l") {   //Oculta cursor
                stopCursor();
            } else if (delim == "q") {   //Comandos de Cursor
                let comstr = escape_seq.substr(2, escape_seq.length-3);
                if (comstr == "?1 ") {   //Cursor de bloque parpadeante
                    curType = 0;
                } else if (comstr == "?2 ") {   //Cursor de bloque estable
                    curType = 0;
                    stopCursorOn();
                } else if (comstr == "?3 ") {   //Cursor de subrayado parpadeante
                    curType = 1;
                } else if (comstr == "?4 ") {   //Cursor de subrayado estable
                    curType = 1;
                    stopCursorOn();
                } else if (comstr == "?5 ") {   //Cursor de barra parpadeante
                    curType = 2;
                } else if (comstr == "?6 ") {   //Cursor de barra estable
                    curType = 2;
                    stopCursorOn();
                }
            } else{
                console.log("Secuencia CSI no implementada");
            }
        } else if (escape_type == ESC_FP) {   //Secuencias privadas
            if (escape_seq == "\x1B7") {    //Guarda cursor y atributos
                crow_tmp = crow;
                ccol_tmp = ccol;
            } else if (escape_seq == "\x1B8") {     //Restaura cursor y atributos
                crow = crow_tmp;
                ccol = ccol_tmp;
            } 
            console.log("Secuencia no implementada");
        } else {
            console.log("Secuencia no implementada");
        }
        //Inicia nueva secuencia
        escape_mode = 0;    //Termina secuencia.
    }
    function putchar(c) {
    /* Escribe un caracter en pantalla. Reconoce secuencias de escape ANSI. */ 
        if (c=="") return;      //Caracter vacío
        if (escape_mode==0) {   //Modo normal
            if (c=="\x0A") {  // "\n"
                nextline();
            } else if (c=="\x0D") { // "\r"
                ccol = 0;
            } else if (c=="\x07") {     //Bell
                beep();
            } else if (c=="\x08") {     //Backspace
                cursor_left();
                deleteChar(crow, ccol);
            } else if (c=="\x09") {     //Tab
                cursor_tab();
            } else if (c=="\x1B") {     //Caracter "ESC"
                //Inicia una secuencia de escape
                escape_mode = 1;        //Activa modo de escape
                ansi.init(c);
            } else {  //Caracter común. Lo escribimos en pantalla.
                //Escribe con el valor actual de los atributos
                if (textNegat=="1") {
                    screen[crow][ccol] = c + textBold + textUnder + backColor + textColor + textItal;
                } else {
                    screen[crow][ccol] = c + textBold + textUnder + textColor + backColor + textItal;
                }
                next();
            }
        } else {    //Modo de escape. 
            ansi.putchar(c);    //Lo procesa el lexer
        }
    }
    function putstring(str) {
    /* Escribe una cadena de texto en pantalla */
        for (let i = 0; i < str.length; i++) {
            putchar(str[i]);
        }    
    };
    ///////// Manejo del terminal
    function write(str) {
        /** Envía una cadena al terminal */
        // Agrega lógica para manejar la tecla presionada
        scrolled = false;
        rowChanged = false;
        hideCursor();  //Apaga el cursor porque vamos a dibujar encima
        //Escribe en memoria
        putstring(str);
        //Refresca pantalla
        ctx.fillStyle = TEXT_COLOR;
        if (scrolled || rowChanged) { 
            //Necesitamos refrescar toda la pantalla
            drawScreen();
        } else {
            drawline(crow);
        }
        showCursor();
    }
    function writeln(str) {
        /* Escribe una línea de texto en pantalla incluyendo un salto de línea al final*/
        write(str + "\n");
    };
    function handleKeyDown(event) {
        /* Procesa la pulsación de una tecla en el terminal. */
        //console.log('Key pressed:', event.key, "-", event.keyCode);
        /* Captura algunas teclas problemáticas para que no pasen al navegador y
        ejecuten alguna acción no deseada. */
        if (event.code === 'Space') event.preventDefault();
        if (event.code === 'Tab') event.preventDefault();
        if (event.key =='Backspace') event.preventDefault();
        if (event.key =='ArrowLeft') event.preventDefault();
        if (event.key =='ArrowRight') event.preventDefault();
        if (event.key =='ArrowDown') event.preventDefault();
        if (event.key =='ArrowUp') event.preventDefault();
        if (event.key =='F1') event.preventDefault();
        if (event.key =='F2') event.preventDefault();
        if (event.key =='F3') event.preventDefault();
        if (event.key =='F4') event.preventDefault();
        //if (event.key =='F5') event.preventDefault();
        if (event.key =='F6') event.preventDefault();
        if (event.key =='F7') event.preventDefault();
        if (event.key =='F8') event.preventDefault();
        if (event.key =='F9') event.preventDefault();
        if (event.ctrlKey) {
            if ( event.key === 'a') event.preventDefault();
            if ( event.key === 'd') event.preventDefault();
            if ( event.key === 'e') event.preventDefault();
            if ( event.key === 'h') event.preventDefault();
            if ( event.key === 's') event.preventDefault();
        }
        //Filtra y traduce las teclas que deben pasar al shell
        let strrec = "" //Cadena recibida
        let cod = event.key.charCodeAt(0);
        if (event.ctrlKey) {
            //Teclas con <Ctrl>.
            
            if (event.key === 'c' || event.key === 'C') {   //Ctrl-C
                strrec = "\x03" //Código usado para estas teclas
            } else if (event.key === 'v' || event.key === 'V') {   //Pegar
                //No se puede leer del Portapapeles por seguridad.
                //let txt = navigator.clipboard.readText();
                //txtReceived(txt);
                return;
            } else {
                return;
            }
        } else if (event.altKey) {
            //Teclas con <Alt>.
            return;
//        } else if (event.shiftKey) {
//            //Teclas con <Shift>.
//            return;
        } else if (event.key=='Shift') {
            return;
        } else if (event.key=='CapsLock') {return;
        } else if (event.key=='NumLock') {return;
        } else if (event.key=='PageUp') {return;
        } else if (event.key=='PageDown') {return;
        } else if (event.key=='Home') {return;
        } else if (event.key=='End') {return;
        } else if (event.key=='Meta') {return;  //Tecla Windows
        } else if (event.key=='Escape') {return;  //Tecla Windows
        } else if (event.key=='F1') {return;  //Tecla Windows
        } else if (event.key=='F2') {return;  //Tecla Windows
        } else if (event.key=='F3') {return;  //Tecla Windows
        } else if (event.key=='F4') {return;  //Tecla Windows
        } else if (event.key=='F5') {return;  //Tecla Windows
        } else if (event.key=='F6') {return;  //Tecla Windows
        } else if (event.key=='F7') {return;  //Tecla Windows
        } else if (event.key=='F8') {return;  //Tecla Windows
        } else if (event.key=='F9') {return;  //Tecla Windows
        } else if (event.key=='Insert') {
            strrec = "\x1B[2~"
        } else if (event.key=='Delete') {
            strrec = "\x1B[3~"
        } else if (event.key=='ArrowLeft') {
            strrec = "\x1B[D"
        } else if (event.key=='ArrowRight') {
            strrec = "\x1B[C"
        } else if (event.key=='ArrowDown') {
            strrec = "\x1B[B"
        } else if (event.key=='ArrowUp') {
            strrec = "\x1B[A"
        } else if (event.key=='Backspace') {
            strrec = "\x08"
        } else if (event.key=='Tab') {
            strrec = "\x09"
        } else {
            //Teclas sin <Ctrl> ni <Alt>.
            if (event.keyCode == 13) {
                strrec = "\x0A";  //13
            } else if (cod>=32 && cod<=126) {
                //Códigos imprimibles
                strrec = event.key
            } else {   //Caracter no permitido 
                return;
            }
        }
        txtReceived(strrec);   //Dispara evento de cadena recibida.
    }
    escape_mode = 0;    //Desactiva
    initScreen();       //Inicializa pantalla
    // Dibuja un carácter en las coordenadas (3, 5)
    //drawChar(3, 5, '@');
    clearBuffer();
}