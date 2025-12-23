import {
  Rule,
  SchematicContext,
  SchematicsException,
  Tree,
} from "@angular-devkit/schematics";
import { NodePackageInstallTask } from "@angular-devkit/schematics/tasks";
import { NgAddSchema } from "./schema";

export function ngAdd(options: NgAddSchema): Rule {
  return (tree: Tree, _context: SchematicContext) => {
    const packagePath = "/package.json";
    const buffer = tree.read(packagePath);

    if (!buffer) {
      throw new SchematicsException(
        "Could not find package.json. Make sure you are in the root of an Angular project."
      );
    }

    const packageJson = JSON.parse(buffer.toString());

    // 1. Obtener la versión de Angular Core
    const angularCoreVer =
      packageJson.dependencies["@angular/core"] ||
      packageJson.devDependencies["@angular/core"];

    if (!angularCoreVer) {
      throw new SchematicsException(
        "The version of @angular/core could not be determined. Please ensure that Angular is installed in your project."
      );
    }

    const mainVersion = parseInt(
      angularCoreVer.replace(/[^\d.]/g, "").split(".")[0],
      10
    );

    // 2. Validación: NgRx Signals requiere Angular 16+ (v17+ recomendado)
    if (mainVersion < 16) {
      _context.logger.error(
        `❌ Error: ngx-essentials requires Angular v16 or higher. Detected: v${mainVersion}`
      );
      return tree; // Stop execution
    }

    // 3. Mapear versión de NgRx (NgRx suele ir a la par con Angular)
    const ngrxVersion = `^${mainVersion}.0.0`;

    _context.logger.info(
      `📦 Configuring dependencies for Angular v${mainVersion}...`
    );

    // 4. Modificar package.json
    const packageName = "ngx-essentials-schematics";

    // Inyectar dependencias compatibles
    packageJson.dependencies = {
      ...packageJson.dependencies,
      "@ngrx/signals": ngrxVersion,
    };

    // Mover a devDependencies si es necesario
    if (packageJson.dependencies[packageName]) {
      const currentVer = packageJson.dependencies[packageName];
      delete packageJson.dependencies[packageName];

      packageJson.devDependencies = {
        ...packageJson.devDependencies,
        [packageName]: currentVer,
      };
    }

    packageJson.dependencies = sortObjectKeys(packageJson.dependencies);
    packageJson.devDependencies = sortObjectKeys(packageJson.devDependencies);

    tree.overwrite(packagePath, JSON.stringify(packageJson, null, 2));

    // 5. Configurar angular.json (Collections y Primary Key)
    updateAngularJson(tree, options);

    // 6. Tarea de instalación
    _context.addTask(new NodePackageInstallTask());

    return tree;
  };
}

function sortObjectKeys(obj: any) {
  return Object.keys(obj)
    .sort()
    .reduce((result: any, key) => {
      result[key] = obj[key];
      return result;
    }, {});
}

function updateAngularJson(tree: Tree, options: NgAddSchema) {
  const path = "/angular.json";
  const buffer = tree.read(path);
  if (!buffer) return;

  const workspace = JSON.parse(buffer.toString());

  if (!workspace.cli) workspace.cli = {};
  const collections = workspace.cli.schematicCollections || [];
  if (!collections.includes("ngx-essentials-schematics")) {
    collections.push("ngx-essentials-schematics");
    workspace.cli.schematicCollections = collections;
  }

  if (!workspace.schematics) workspace.schematics = {};
  workspace.schematics["ngx-essentials-schematics:all"] = {
    pk: options.pk,
  };

  tree.overwrite(path, JSON.stringify(workspace, null, 2));
}
