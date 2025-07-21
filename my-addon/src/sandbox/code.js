import addOnSandboxSdk from "add-on-sdk-document-sandbox";
import { editor } from "express-document-sdk";

// Get the document sandbox runtime.
const { runtime } = addOnSandboxSdk.instance;



function start() {
    // APIs to be exposed to the UI runtime
    // i.e., to the `index.html` file of this add-on.
    const sandboxApi = {
        createRectangle: () => {
            const rectangle = editor.createRectangle();

            // Define rectangle dimensions.
            rectangle.width = 240;
            rectangle.height = 180;

            // Define rectangle position.
            rectangle.translation = { x: 10, y: 10 };

            // Define rectangle color.
            const color = { red: 0.32, green: 0.34, blue: 0.89, alpha: 1 };

            // Fill the rectangle with the color.
            const rectangleFill = editor.makeColorFill(color);
            rectangle.fill = rectangleFill;

            // Add the rectangle to the document.
            const insertionParent = editor.context.insertionParent;
            insertionParent.children.append(rectangle);
        },

        getSelectedItems: () => {
            try {
              const selectedNodes = editor.context.selection;          
              const selectedItems = [];
              if (selectedNodes && selectedNodes.length > 0) {
                selectedNodes.forEach((node, index) => {
                  const bounds = node.boundsInParent;
          
                  selectedItems.push({
                    id: node.id || `item-${index}`,
                    type: node.constructor.name,
                    position: { x: bounds.x, y: bounds.y },
                    size: {
                      width: bounds.width,
                      height: bounds.height
                    },
                    fill: node.fill,
                    stroke: node.stroke
                  });
                });
              }
          
              return {
                success: true,
                items: selectedItems,
                count: selectedItems.length,
                message: `found ${selectedItems.length} selected item`
              };
            } catch (error) {
              console.error("Error:", error);
              return {
                success: false,
                error: error.message,
                items: [],
                count: 0
              };
            }
        },

    };

    // Expose `sandboxApi` to the UI runtime.
    runtime.exposeApi(sandboxApi);
}

start();
