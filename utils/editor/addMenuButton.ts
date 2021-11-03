import tinymce from "tinymce/tinymce";
export default function addMenuButton(name: string, config: any) {
  tinymce.PluginManager.add(name, (editor) => {
    editor.ui.registry.addButton(name, config);
    editor.ui.registry.addMenuItem(name, config);
  });
}
