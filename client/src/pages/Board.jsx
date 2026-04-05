import {useState, useEffect, useRef, useCallBack } from "react";
import {Stage, Layer, Line } from "react-konva";
import { useParams, useNavigate } from "react-router-dom";


const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || "http://localhost:3001";

export default function Board({ shared = false}) {
    const {id, token} = useParams();
    const navigate = useNavigate();

    const [role, setRole] = useState('editor'); // editor or viewer

    const canDraw = role === 'editor';

    return ("");
}