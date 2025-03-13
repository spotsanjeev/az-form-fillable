const express = require("express");
const axios = require("axios");
const cors = require("cors");
const { PDFDocument } = require("pdf-lib");

const app = express();
const PORT = 3000;
const PDF_URL = "https://www.uscis.gov/sites/default/files/document/forms/i-9.pdf"; // Replace with any PDF URL

app.use(cors());

app.get("/", async (req, res) => {
    try {
        // Fetch PDF as array buffer
        const response = await axios.get(PDF_URL, { responseType: "arraybuffer" });
        const pdfBase64 = Buffer.from(response.data).toString("base64");

        // Send back HTML page
        res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>Fillable PDF Viewer</title>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.3.122/pdf.min.js"></script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.3.122/pdf.worker.min.js"></script>
            <script src="https://unpkg.com/pdf-lib"></script>
            <style>
                body { font-family: Arial, sans-serif; text-align: center; }
                .wrapper { width: 90%; margin: auto; }
                #pdf-container { width: 100%; border: 1px solid #ccc; position: relative; }
                .input-field, .checkbox-field, .radio-field, .select-field { position: absolute; background: transparent; font-size: 16px; border: none; }
                #save-button { margin: 20px; padding: 10px 20px; font-size: 16px; cursor: pointer; }
            </style>
        </head>
        <body>

            <h1>Fillable PDF Viewer</h1>
            <button id="save-button">Save Updated PDF</button>
            <div class="wrapper">
                <div id="pdf-container"></div>
            </div>

            <script>
                document.addEventListener("DOMContentLoaded", async () => {
                    const pdfData = atob("${pdfBase64}");
                    const pdfViewerContainer = document.getElementById("pdf-container");
                    const saveButton = document.getElementById("save-button");

                    let formFields = [];

                    try {
                        const loadingTask = pdfjsLib.getDocument({ data: Uint8Array.from([...pdfData].map(c => c.charCodeAt(0))), annotationMode: 2 });
                        const pdf = await loadingTask.promise;

                        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                            const page = await pdf.getPage(pageNum);
                            const scale = 1.5;
                            const viewport = page.getViewport({ scale });

                            const pageContainer = document.createElement("div");
                            pageContainer.style.position = "relative";
                            pageContainer.style.width = viewport.width + "px";
                            pageContainer.style.height = viewport.height + "px";

                            const canvas = document.createElement("canvas");
                            const context = canvas.getContext("2d");
                            canvas.height = viewport.height;
                            canvas.width = viewport.width;
                            pageContainer.appendChild(canvas);
                            pdfViewerContainer.appendChild(pageContainer);

                            await page.render({ canvasContext: context, viewport }).promise;

                            const annotations = await page.getAnnotations();
                            annotations.forEach(annotation => {
                                let field;
                                if (annotation.fieldType === "Tx") {
                                    field = document.createElement("input");
                                    field.type = "text";
                                } else if (annotation.fieldType === "Btn" && annotation.checkBox) {
                                    field = document.createElement("input");
                                    field.type = "checkbox";
                                    field.checked = annotation.fieldValue === "Yes";
                                } else if (annotation.fieldType === "Btn" && annotation.radioButton) {
                                    field = document.createElement("input");
                                    field.type = "radio";
                                    field.name = annotation.fieldName;
                                    field.checked = annotation.fieldValue === "Yes";
                                } else if (annotation.fieldType === "Ch") {
                                    field = document.createElement("select");
                                    annotation.options.forEach(option => {
                                        const opt = document.createElement("option");
                                        opt.value = option.value;
                                        opt.textContent = option.displayValue;
                                        if (annotation.fieldValue === option.value) opt.selected = true;
                                        field.appendChild(opt);
                                    });
                                }

                                if (field) {
                                    field.style.position = "absolute";
                                    field.style.left = annotation.rect[0] * scale + "px";
                                    field.style.top = (viewport.height - annotation.rect[3] * scale) + "px";
                                    field.style.width = (annotation.rect[2] - annotation.rect[0]) * scale + "px";
                                    field.style.height = (annotation.rect[3] - annotation.rect[1]) * scale + "px";
                                    pageContainer.appendChild(field);
                                    formFields.push({ id: annotation.fieldName, value: field.value, element: field });
                                }
                            });
                        }
                    } catch (error) {
                        console.error("Error loading PDF:", error);
                        pdfViewerContainer.innerHTML = "<p>Failed to load PDF.</p>";
                    }

                

               
                });
            </script>

        </body>
        </html>
        `);
    } catch (error) {
        res.status(500).send("Error fetching PDF");
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
