<?php
include '../../globales.php';
session_start();  //Para identificar a la sesión
incHeader("#","#");
iniPanelBegin();
    //$ciud = add_edit('Ciudad desde donde se escribe:', 'ciud', 'Lima');
    $modo = add_listbox('Estilo:', 'modo', ['Básico','Avanzado'], 'Básico');
    //$nsum = add_listrad('Núm. de sumandos', 'nsum', ['2 sumandos', '3 sumandos', '2 o 3 sumandos'], '2 sumandos');

iniPanelEnd();
    setlocale(LC_ALL,"es_ES");
?>
<style>
    .terminal-header {
        display: flex;
        align-items: center;
        background-color: #333;
        padding: 5px;
    }
    .terminal-buttons {
        display: flex;
        gap: 5px;
    }
    .terminal-button {
        width: 10px;
        height: 10px;
        border-radius: 50%;
    }
    .close { background-color: #f44; }
    .minimize { background-color: #ff0; }
    .maximize { background-color: #0f4; }
    .terminal-title {
        flex: 1;
        color: #fff;
        text-align: center;
    }
    .canvas-container {
        border: 1px solid #000;
        text-align:center;
        float:left;  /* Para ajustar tamaño a contenido*/
        background-color: #000;
        border-radius: 5px;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
        overflow: hidden;
    }
</style>
    <!-- Terminal -->
    <div class="canvas-container">
        <div class="terminal-header">
            <div class="terminal-buttons">
                <div class="terminal-button close"></div>
                <div class="terminal-button minimize"></div>
                <div class="terminal-button maximize"></div>
            </div>
            <div class="terminal-title">Terminal</div>
        </div>
        <canvas class="screen_area" id="id_cnv1" height="100" width="100" tabindex="0"></canvas>
    </div>
    <!--link rel="stylesheet" href="term.css"-->
    <script src="titoansi.js"></script>    
    <script src="titoterm.js"></script>    
    <script src="shell_emu.js"></script>    
    <script>
        var shell = new TitoShellEmul(shellResponse)
        var term  = new TitoTerm("id_cnv1", termTxtReceived);
        function termTxtReceived(str) {
            //El terminal ha recibido una cadena de texto. Normalmente solo recibe una tecla.
            shell.write(str);
        }
        function shellResponse(str) {
            //El shell ha respondido con una cadena
            term.write(str);
        }
        shell.init();
        /* Se hace un primer volcado para refrescar (y dibujar) toda la pantalla. Después
        se refrescarán las secciones afectadas por efecto de lo que se vaya enviando al 
        terminal*/
        term.drawScreen();   
    </script>
<?php    
finPanel();
incFooter();
?>