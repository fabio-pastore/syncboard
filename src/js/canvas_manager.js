const DEFAULT_BRUSH_COLOR = "#000000"
const DEFAULT_BRUSH_SIZE = 3;
class Canvas { 

    // private fields
    #canvas;
    #color_picker;
    #brush_size_picker;
    #clear_button;
    #context;
    #is_pointer_down;
    #last_x_pos;
    #last_y_pos;

    // public fields
    stroke_color;
    stroke_width;

    constructor() {
        this.#canvas = document.getElementById("boardCanvas");
        this.#color_picker = document.getElementById("brushColor");
        this.#brush_size_picker = document.getElementById("brushSize");
        this.#clear_button = document.getElementById("clearButton");
        this.#context = this.#canvas.getContext("2d");
        this.#is_pointer_down = false;
        this.#last_x_pos = null;
        this.#last_y_pos = null;
        this.stroke_color = DEFAULT_BRUSH_COLOR;
        this.stroke_width = DEFAULT_BRUSH_SIZE;
        this.#initCanvas();
    }

    #initCanvas() {

        this.#canvas.width = this.#canvas.offsetWidth;
        this.#canvas.height = this.#canvas.offsetHeight;
        this.#canvas.style.touchAction = "none";

        this.#context.strokeStyle = this.stroke_color;
        this.#context.lineWidth = this.stroke_width;
        this.#context.lineCap = "round";
        this.#context.lineJoin = "round";

        this.#color_picker.addEventListener("input", () => this.setBrushColor());
        this.#brush_size_picker.addEventListener("input", () => this.setBrushSize());
        this.#clear_button.addEventListener("click", () => this.clearCanvas());

        this.#canvas.addEventListener("pointerdown", (e) => this.#pointerDownHandler(e));
        this.#canvas.addEventListener("pointermove", (e) => this.#pointerMoveHandler(e));
        this.#canvas.addEventListener("pointerup", (e) => this.#pointerUpHandler(e));
        this.#canvas.addEventListener("pointerleave", (e) => this.#pointerUpHandler(e));
    }

    #getPointerPos(e) {
        let client_rect = this.#canvas.getBoundingClientRect();
        return {
            x: (e.clientX - client_rect.left) * (this.#canvas.width / client_rect.width),
            y: (e.clientY - client_rect.top) * (this.#canvas.height / client_rect.height)
        };
    }

    #pointerDownHandler(e) {

        if (e.button == 1) { // NOTE: e.button == 1 if and only if the middle mouse button was clicked (we will use this to reset the canvas for the time being)
            e.preventDefault();
            this.clearCanvas();
        }

        else {
            this.#is_pointer_down = true;
            let pointer_pos = this.#getPointerPos(e);
            this.#last_x_pos = pointer_pos.x;
            this.#last_y_pos = pointer_pos.y;
        }
    }

    #pointerMoveHandler(e) {

        let pointer_pos = this.#getPointerPos(e);
        let new_x_pos = pointer_pos.x;
        let new_y_pos = pointer_pos.y;

        if (this.#is_pointer_down) {
            this.#context.beginPath();
            this.#context.moveTo(this.#last_x_pos, this.#last_y_pos);
            this.#context.lineTo(new_x_pos, new_y_pos);
            this.#context.stroke();
            this.#last_x_pos = new_x_pos;
            this.#last_y_pos = new_y_pos;
        }
    }

    #pointerUpHandler(e) {
        this.#is_pointer_down = false;
    }

    clearCanvas() {
        this.#context.clearRect(0, 0, this.#context.canvas.width, this.#context.canvas.height);
        this.#context.beginPath(); // discard any previous undrawn lines
    }

    setBrushColor() {
        this.#context.strokeStyle = this.#color_picker.value;
    }

    setBrushSize() {
        this.#context.lineWidth = this.#brush_size_picker.value;
    }

}

const MY_CANVAS = new Canvas();


