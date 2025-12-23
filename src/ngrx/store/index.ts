import { join, normalize, strings } from "@angular-devkit/core";
import {
  apply,
  applyTemplates,
  chain,
  forEach,
  mergeWith,
  move,
  Rule,
  Tree,
  url,
} from "@angular-devkit/schematics";
import { getWorkspace } from "@schematics/angular/utility/workspace";
import { StoreSchemaOptions } from "./schema";

const pluralizeEs = (name: string): string => {
  if (!name) return name;
  const lastChar = name.slice(-1).toLowerCase();
  const vowels = ["a", "e", "i", "o", "u"];
  if (vowels.includes(lastChar)) return name + "s";
  if (lastChar === "z") return name.slice(0, -1) + "ces";
  return name + "es";
};

const pluralizeEn = (name: string): string => {
  if (!name) return name;
  const lastChar = name.slice(-1).toLowerCase();
  const vowels = ["a", "e", "i", "o", "u"];
  if (lastChar === "y" && !vowels.includes(name.slice(-2, -1).toLowerCase())) {
    return name.slice(0, -1) + "ies";
  }
  if (
    ["s", "x", "z", "ch", "sh"].some((end) => name.toLowerCase().endsWith(end))
  ) {
    return name + "es";
  }
  return name + "s";
};

function mergeFilesSmart(
  urlPath: string,
  destPath: string,
  options: any
): Rule {
  return mergeWith(
    apply(url(urlPath), [
      applyTemplates({ ...strings, ...options }),
      move(destPath),
      forEach((fileEntry) => {
        // Si el archivo ya existe en el árbol
        if (treeRef.exists(fileEntry.path)) {
          const existingContent = treeRef.read(fileEntry.path)!.toString();
          const newContent = fileEntry.content.toString();

          // Solo escribimos si el contenido nuevo no está ya incluido (basado en una cadena clave o firma)
          // Puedes ajustar esta condición según lo que necesites verificar
          if (existingContent.includes(newContent.trim())) {
            return null; // Descarta el archivo del proceso de merge (no hace nada)
          }

          // Si el archivo existe pero queremos añadir contenido al final (opcional)
          // treeRef.overwrite(fileEntry.path, existingContent + '\n' + newContent);
          return null;
        }
        return fileEntry;
      }),
    ])
  );
}

let treeRef: Tree;

export function signalStore(options: StoreSchemaOptions): Rule {
  return async (tree: Tree) => {
    const workspace = await getWorkspace(tree);
    const globalConfig = (workspace.extensions as any).schematics?.[
      "ngx-autogen:all"
    ];
    if (globalConfig && globalConfig.pk && !options.pk) {
      options.pk = globalConfig.pk;
    }

    treeRef = tree;
    const movePath = normalize(options.path);

    const indexPath = join(movePath, "index.ts");
    const nameDash = strings.dasherize(options.name);
    const entityName = strings.classify(options.name);

    const entityHeader = `/* ${entityName.toUpperCase()} */`;
    const exportBlock = [
      entityHeader,
      `export * from './${nameDash}/${nameDash}.model';`,
      `export * from './${nameDash}/${nameDash}.service';`,
      `export * from './${nameDash}/${nameDash}.store';`,
      "",
    ].join("\n");

    let content = "";

    if (tree.exists(indexPath)) {
      content = tree.read(indexPath)!.toString();
    }

    if (content.includes(entityHeader)) {
      const lines = exportBlock.split("\n");
      lines.forEach((line) => {
        if (line.trim() !== "" && !content.includes(line)) {
          content += line + "\n";
        }
      });
    } else {
      content =
        content.trim() + (content.length > 0 ? "\n\n" : "") + exportBlock;
    }

    if (tree.exists(indexPath)) {
      tree.overwrite(indexPath, content);
    } else {
      tree.create(indexPath, content);
    }

    const templateStoreSource = apply(url("./files/store"), [
      applyTemplates({
        ...strings,
        ...options,
        pluralize: (word: string) => {
          switch (options.lang) {
            case "es":
              return pluralizeEs(word);
            default:
              return pluralizeEn(word);
          }
        },
        pk: options.pk || "id",
      }),
      move(join(movePath, strings.dasherize(options.name))),
    ]);

    const commonEntityRule = mergeFilesSmart(
      "./files/entity",
      join(movePath, "common/entity"),
      options
    );

    return chain([mergeWith(templateStoreSource), commonEntityRule]);
  };
}
