# ngx-essentials-schematics

[![Language: English](https://img.shields.io/badge/lang-en-blue.svg)](README.md)
[![Language: Spanish](https://img.shields.io/badge/lang-es-yellow.svg)](README.es.md)

**ngx-essentials-schematics** es un conjunto de schematics diseñados para optimizar y estandarizar el flujo de trabajo en proyectos Angular. Esta librería proporciona herramientas de generación de código que siguen las mejores prácticas, permitiendo a los desarrolladores ahorrar tiempo en tareas repetitivas y configuración de arquitectura.

## 🚀 Características

El proyecto se lanza inicialmente con un enfoque en la gestión de estado, pero está diseñado para crecer:

- **Store Schematic**: Nuestro primer schematic disponible. Permite generar automáticamente toda la estructura necesaria para un store basado en signals (NGRX-Signals), facilitando la integración rápida y escalable de la gestión de estado en tus aplicaciones.

## 📅 Próximamente

**ngx-essentials-schematics** es un proyecto en evolución continua. Se irán agregando progresivamente nuevas herramientas y schematics para cubrir más aspectos del desarrollo en Angular, como:

- Generación de servicios y utilidades.
- Scaffolding para componentes avanzados.

## 📦 Instalación

Puedes instalar el paquete en tu proyecto Angular mediante angular cli para que se configure automáticamente el proyecto con las dependencias necesarias:

```bash
ng add ngx-essentials-schematics
```

## 🛠️ Uso

### Generar un Store

#### Propiedades

- `name`(obligatorio): nombre del store.
- `pk`(opcional): nombre de la primary key, si no se especifica se usara la especificada en el proceso de instalacion del schematic, de lo contrario se usara `id`.
- `path`(opcional): ruta del store, si no se especifica se usara la especificada en el proceso de instalacion del schematic, de lo contrario se usara `src/app/core`.

#### Ejemplo

```bash
ng g app-store --name="user" --pk="cod"
```

Esto creará los archivos `user.model.ts`, `user.service.ts`, `user.store.ts` dentro de la carpeta `src/app/core/user`, el archivo `entity.model.ts` si no existe, dentro de la carpeta `src/app/core/common/entity` y el archivo `index.ts` dentro de la carpeta `src/app/core`.

```bash
common/
└── entity/
    └── entity.model.ts
user/
├── user.service.ts
├── user.model.ts
└── user.store.ts
index.ts
```

El archivo `index.ts` exportará todo lo necesario para que el store pueda ser importado y utilizado en cualquier parte de la aplicación.

```bash
/* USER */
export * from './user/user.model';
export * from './user/user.service';
export * from './user/user.store';
```

El archivo `entity.model.ts` contiene las interfaces y tipos necesarios para el manejo de estados y formularios.

```bash
import { FormControl } from '@angular/forms';

export interface EntityStatus {
  addError?: Error | null;
  addLoading?: boolean;
  removeError?: Error | null;
  removeLoading?: boolean;
  error: Error | null;
  idsRemoving?: (number | string)[];
  idSelected?: null | number | string;
  idsUpdating?: (number | string)[];
  loaded: boolean;
  loading: boolean;
  selectedError?: Error | null;
  selectedLoading?: boolean;
  updateError?: Error | null;
  updateLoading?: boolean;
}

export type FormGroupType<T> = {
  [K in keyof T]: FormControl<T[K]>;
};
```

El archivo `user.model.ts` contiene la interface del modelo de datos.

```bash
import { FormGroupType } from '../common/form/form.model';

export interface AddUser {
}

export type AddUserForm = FormGroupType<AddUser>;

export interface UserDto {
  cod: number;
}

export type UpdateUser = Partial<UserDto> & Pick<UserDto, 'cod'>;

export interface UserRequest{}
```

El archivo `user.service.ts` contiene el servicio que se encarga de la lógica de negocio.

```bash
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import {
  AddUser,
  UserDto,
  UpdateUser
} from './user.model';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  addUser$(entity: AddUser): Observable<number> {
    return of(0);
  }

  removeUser$(cod: number): Observable<boolean> {
    return of(true);
  }

  getUsers$(): Observable<UserDto[]> {
    return of([]);
  }

  updateUser$(entity: UpdateUser): Observable<boolean> {
    return of(true);
  }
}
```

El archivo `user.store.ts` contiene el store que se encarga de la gestión de estado.

```bash
import { computed, inject } from '@angular/core';
import { patchState, signalStore, type, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import {
  addEntity,
  entityConfig,
  removeEntity,
  setAllEntities,
  updateEntity,
  withEntities
} from '@ngrx/signals/entities';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { catchError, of, pipe, switchMap, tap } from 'rxjs';

import { EntityStatus } from '../common/entity/entity.model';
import {
  UserDto,
  AddUser,
  UpdateUser
} from './user.model';
import { UserService } from './user.service';

const initialStatus: EntityStatus = {
  error: null,
  loaded: false,
  loading: false,
};

const config = entityConfig({
  entity: type<UserDto>(),
  selectId: (entity) => entity.cod,
});

export const UserStore = signalStore(
  withEntities(config),
  withState({
    _status: initialStatus,
  }),
  withComputed(({ entityMap, _status }) => ({
    users: computed(() => Object.values(entityMap())),
    userSeleccionado: computed(() => {
      const cod = _status().idSelected;
      return cod ? entityMap()[cod] : null;
    }),
    error: computed(() => _status().error),
    loaded: computed(() => _status().loaded),
    loading: computed(() => _status().loading),
    loadingRemove: computed(
      () => (cod?: number) =>
        (cod ? _status().idsRemoving?.includes(cod) : _status().removeLoading) || false
    ),
    loadingUpdate: computed(
      () => (cod?: number) =>
        (cod ? _status().idsUpdating?.includes(cod) : _status().updateLoading) || false
    ),
  })),
  withMethods((store, userService = inject(UserService)) => ({
    addUser: rxMethod<AddUser>(
      pipe(
        tap(() => {
          patchState(store, { _status: { ...store._status(), addLoading: true } });
        }),
        switchMap((entity) => {
          return userService.addUser$(entity).pipe(
            tap((cod) => {
              patchState(store, addEntity({ ...entity, cod }, config), {
                _status: {
                  ...store._status(),
                  addLoading: false,
                  error: null,
                },
              });
            }),
            catchError(() => {
              patchState(store, {
                _status: {
                  ...store._status(),
                  addLoading: false,
                  error: new Error('Error al agregar user'),
                },
              });
              return of(entity);
            })
          );
        })
      )
    ),
    loadUsers: rxMethod<void>(
      pipe(
        tap(() => {
          patchState(store, { _status: { ...store._status(), loading: true } });
        }),
        switchMap(() => {
          return userService.getUsers$().pipe(
            tap((response) => {
              patchState(store, setAllEntities(response, config), {
                _status: {
                  ...store._status(),
                  error: null,
                  loaded: true,
                  loading: false,
                },
              });
            }),
            catchError(() => {
              patchState(store, {
                _status: {
                  ...store._status(),
                  error: new Error('Error al cargar users'),
                  loading: false,
                },
              });
              return of([]);
            })
          );
        })
      )
    ),
    removeUser: rxMethod<number>(
      pipe(
        tap((cod) => {
          patchState(store, {
            _status: {
              ...store._status(),
              removeLoading: true,
              idsRemoving: [...(store._status().idsRemoving || []), cod],
            },
          });
        }),
        switchMap((cod) => {
          return userService.removeUser$(cod).pipe(
            tap((success) => {
              if (success) {
                const idsRemoving = store._status().idsRemoving || [];
                patchState(store, removeEntity(cod), {
                  _status: {
                    ...store._status(),
                    removeLoading: false,
                    error: null,
                    idsRemoving: idsRemoving.filter((idRemoving) => idRemoving !== cod),
                  },
                });
              } else {
                throw new Error('Error al eliminar user');
              }
            }),
            catchError(() => {
              const idsRemoving = store._status().idsRemoving || [];
              patchState(store, {
                _status: {
                  ...store._status(),
                  removeLoading: false,
                  error: new Error('Error al eliminar user'),
                  idsRemoving: idsRemoving.filter((idRemoving) => idRemoving !== cod),
                },
              });
              return of(false);
            })
          );
        })
      )
    ),
    updateUser: rxMethod<UpdateUser>(
      pipe(
        tap((entity) => {
          patchState(store, {
            _status: {
              ...store._status(),
              idsUpdating: [...(store._status().idsUpdating || []), entity.cod],
              updateLoading: true,
            },
          });
        }),
        switchMap((entity) => {
          return userService.updateUser$(entity).pipe(
            tap((success) => {
              if (success) {
                const idsUpdating = store._status().idsUpdating || [];
                patchState(store, updateEntity({ changes: entity, id: entity.cod }, config), {
                  _status: {
                    ...store._status(),
                    error: null,
                    idsUpdating: idsUpdating.filter((idUpdating) => idUpdating !== entity.cod),
                    updateLoading: false,
                  },
                });
              } else {
                throw new Error('Error al actualizar user');
              }
            }),
            catchError(() => {
              const idsUpdating = store._status().idsUpdating || [];
              patchState(store, {
                _status: {
                  ...store._status(),
                  error: new Error('Error al actualizar user'),
                  idsUpdating: idsUpdating.filter((idUpdating) => idUpdating !== entity.cod),
                  updateLoading: false,
                },
              });
              return of(false);
            })
          );
        })
      )
    ),
  })),
  withHooks({
    onInit: (store) => {
      store.loadUsers();
    },
  })
);
```

## 📄 Licencia

Este proyecto está bajo la licencia [MIT](LICENSE).
