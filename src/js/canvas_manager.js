const DEFAULT_BRUSH_COLOR = "#000000"
const DEFAULT_BRUSH_SIZE = 3;

var canvas;
var color_picker;
var brush_size_picker;
var clear_button;
var context;
var is_pointer_down;
var last_x_pos, last_y_pos;
var stroke_color;
var stroke_width;

function getPointerPos(e) {
    let client_rect = canvas.getBoundingClientRect();
    return {
        x: (e.clientX - client_rect.left) * (canvas.width / client_rect.width),
        y: (e.clientY - client_rect.top) * (canvas.height / client_rect.height)
    };
}

function pointerDownHandler(e) {

    if (e.button == 1) { // NOTE: e.button == 1 if and only if the middle mouse button was clicked (we will use this to reset the canvas for the time being)
        e.preventDefault();
        clearCanvas();
    }

    else {
        is_pointer_down = true;
        let pointer_pos = getPointerPos(e);
        last_x_pos = pointer_pos.x;
        last_y_pos = pointer_pos.y;
    }
}

function pointerMoveHandler(e) {

    let pointer_pos = getPointerPos(e);
    let new_x_pos = pointer_pos.x;
    let new_y_pos = pointer_pos.y;

    if (is_pointer_down) {
        context.beginPath();
        context.moveTo(last_x_pos, last_y_pos);
        context.lineTo(new_x_pos, new_y_pos);
        context.stroke();
        last_x_pos = new_x_pos;
        last_y_pos = new_y_pos;
    }
}

function pointerUpHandler(e) {
    is_pointer_down = false;
}

function clearCanvas() {
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    context.beginPath(); // discard any previous undrawn lines
}

function setBrushColor() {
    context.strokeStyle = color_picker.value;
}

function setBrushSize() {
    context.lineWidth = brush_size_picker.value;
}

function init_canvas_manager() {
    canvas = document.getElementById("boardCanvas");
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    canvas.style.touchAction = "none";

    is_pointer_down = false;
    stroke_color = DEFAULT_BRUSH_COLOR;
    stroke_width = DEFAULT_BRUSH_SIZE;

    context = canvas.getContext("2d");
    context.strokeStyle = stroke_color;
    context.lineWidth = stroke_width;
    context.lineCap = "round";
    context.lineJoin = "round";


    color_picker = document.getElementById("brushColor");
    color_picker.addEventListener("input", setBrushColor);

    brush_size_picker = document.getElementById("brushSize");
    brush_size_picker.addEventListener("input", setBrushSize);

    clear_button = document.getElementById("clearButton");
    clear_button.addEventListener("click", clearCanvas);

    canvas.addEventListener("pointerdown", pointerDownHandler);
    canvas.addEventListener("pointermove", pointerMoveHandler);
    canvas.addEventListener("pointerup", pointerUpHandler);
    canvas.addEventListener("pointerleave", pointerUpHandler);
    return 0;
}

init_canvas_manager();

