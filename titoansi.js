/* Define a una clase que permite reconocer secuencias de escape ANSI.
Basado en: https://en.wikipedia.org/wiki/ANSI_escape_code
Se crea como un archivo separado para que pueda ser usado también desde otros proyectos.
Por Tito Hinostroza 20/08/2024 
*/

    //Tipos de secuencia de escape: 
    const ESC_UND = 0;  // Undefined
    const ESC_FP  = 1;  // Fp  
    const ESC_FE  = 2;  // Fe
    const ESC_FS  = 4;  // Fs
    //Secuencias especiales de tipo "Fe"
    const ESC_DCS = 21;  // DCS. 
    const ESC_CSI = 22;  // CSI (Control Sequence Introducer). 
    const ESC_OSC = 23;  // OSC.
    const ESC_SOS = 24;  // SOS.
    const ESC_PM  = 25;  // PM. 
    const ESC_APC = 26;  // APC.
    const ESC_ST  = 27;  // ST

    class CAnsiEscape {
    //Variables para secuencias de escape
        escape_type = ESC_UND;  //Tipo de secuencia de escape 
        escape_seq = "";        //Secuencia de escape en cadena
        escape_end = false;     //Indica si se encontró un ESC al buscar el delimitador final.
        executeSeq = null;      //Rutina a ejecutar cuando se ha terminado de capturar una secuencia de escape

        constructor(executeSeq) {   
          this.executeSeq = executeSeq;
        }
        init(c) {
            /**Inicializa el lexer para empezar a reconocer las secuencias de escape.
             * El parámetro "c" es el primer caracter de la secuencia de escape. 
             * Normalmente debe ser el caracter de escape "\x1B". 
             */
            this.escape_type = ESC_UND;  //No definido aún
            this.escape_seq  = c;        //Primer caracter
            this.escape_end  = false;    //Bandera de delimitador
        }
        putchar(c) {
            /* Método que debe llamarse por cada tecla recibida cuando se está en modo de
             escape.
             Ref. https://bjh21.me.uk/all-escapes/all-escapes.txt  */
             this.escape_seq += c;
             let code = c.charCodeAt(0);
             if (this.escape_seq.length == 2) { //Segundo caracter
                 if (code>=0x30 && code<=0x3F) {  //Secuencia "Fp". 
                    //Secuencias privadas 
                    this.escape_type = ESC_FP;    //Tipo "Fp"
                    if (c == "7" || c == "8") { //Comandos de VT100
                        //Es una secuencia de 2 bytes. La terminamos.
                        this.executeSeq(this.escape_type, this.escape_seq);
                    } else {
                        //Otra secuencia privada. No la reconocemos aún.
                        this.executeSeq(this.escape_type, this.escape_seq);   //Reinicia secuencia
                    }
                 //Casos especiales de "Fe".
                 } else if (c == "P") {  //"ESC P". 
                    this.escape_type = ESC_DCS;    
                     //El delimitador se buscará después
                 } else if (c == "[") {  //"ESC [". 
                    this.escape_type = ESC_CSI;    
                     //El delimitador se buscará después
                 } else if (c == "]") {  //"ESC ]". 
                    this.escape_type = ESC_OSC;
                     //El delimitador se buscará después
                 } else if (c == "X") {  //"ESC X". 
                    this.escape_type = ESC_SOS;
                     //El delimitador se buscará después
                 } else if (c == "^") {  //"ESC ^". 
                    this.escape_type = ESC_PM;
                     //El delimitador se buscará después
                 } else if (c == "_") {  //"ESC _". 
                    this.escape_type = ESC_APC;
                     //El delimitador se buscará después
                 } else if (c == "\\") {  //"ESC \". 
                    this.escape_type = ESC_ST;
                     //Es un delimitador de secuencia. No debería aparecer aquí.
                     this.executeSeq(this.escape_type, this.escape_seq);   //Reinicia secuencia
                 //Otros casos de "Fe".
                 } else if (code>=0x40 && code<=0x5F) {  //Secuencia "Fe".
                    this.escape_type = ESC_FE;    //Tipo "Fe"
                     //Es secuencia de 2 bytes
                     this.executeSeq(this.escape_type, this.escape_seq);
                 } else if (code>=0x60 && code<=0x7E) {  //Secuencia "Fs"
                    this.escape_type = ESC_FS;    //Tipo "Fs"
                     //Es secuencia de 2 bytes
                     this.executeSeq(this.escape_type, this.escape_seq);
                 } else {
                     //De ser una secuencia desconocida. No la reconocemos.
                     this.executeSeq(this.escape_type, this.escape_seq);   //Reinicia secuencia
                 }
             } else {  //Un caracter posterior
                 //Buscamos el delimitador final
                 if (this.escape_end) {    //La tecla anterior fue ESC
                     if (code == 92) {    //ESC \ --> Secuencia "ST".
                         //La secuencia ST es delimitador de varias secuencias "Fe".
                         //Por simplicidad, asumimos que es delimitador de todas las secuencias:
                         this.executeSeq(this.escape_type, this.escape_seq);
                     }
                     this.escape_end = false; //Limpia para detectar secuencia "ST".
                 }
                 if (code == 27) this.escape_end = true;  //Marca bandera
                 if (this.escape_type == ESC_CSI) {   //Tipo "CSI"
                     //Busca delimitador
                     if (code>=0x40 && code<=0x7E) {  //Fin de secuencia
                        this.executeSeq(this.escape_type, this.escape_seq);
                     }
                 } else {
                     //Otra secuencia. No la reconocemos aún.
                     this.executeSeq(this.escape_type, this.escape_seq);   //Reinicia secuencia
                 }
             }
 
        }
    }