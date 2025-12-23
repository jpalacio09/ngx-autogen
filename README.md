# ngx-autogen

[![Language: English](https://img.shields.io/badge/lang-en-blue.svg)](README.md)
[![Language: Spanish](https://img.shields.io/badge/lang-es-yellow.svg)](README.es.md)

**ngx-autogen** is a set of schematics designed to optimize and standardize the workflow in Angular projects. This library provides code generation tools that follow best practices, allowing developers to save time on repetitive tasks and architecture configuration.

## 🚀 Features

The project is initially launched with a focus on state management, but is designed to grow:

- **Store Schematic**: Our first available schematic. It allows you to automatically generate the entire structure needed for a store based on signals (NGRX-Signals), facilitating the quick and scalable integration of state management in your applications.

## 📅 Coming Soon

**ngx-autogen** is a project in continuous evolution. New tools and schematics will be progressively added to cover more aspects of Angular development, such as:

- Generation of services and utilities.
- Scaffolding for advanced components.

## 📦 Installation

You can install the package in your Angular project using Angular CLI so that the project is automatically configured with the necessary dependencies:

```bash
ng add ngx-autogen
```

## 🛠️ Usage

### Generate a Store

#### Properties

- `name` (required): name of the store.
- `pk` (optional): name of the primary key. If not specified, the one specified during the schematic installation process will be used; otherwise, `id` will be used.
- `path` (optional): path of the store. If not specified, the one specified during the schematic installation process will be used; otherwise, `src/app/core` will be used.

#### Example

```bash
ng g app-store --name="user" --pk="cod"
```

This will create the files `user.model.ts`, `user.service.ts`, `user.store.ts` within the `src/app/core/user` folder, the `entity.model.ts` file if it doesn't exist within the `src/app/core/common/entity` folder, and the `index.ts` file within the `src/app/core` folder.

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

The `index.ts` file will export everything necessary so that the store can be imported and used anywhere in the application.

```bash
/* USER */
export * from './user/user.model';
export * from './user/user.service';
export * from './user/user.store';
```

The `entity.model.ts` file contains the interfaces and types necessary for state and form management.

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

The `user.model.ts` file contains the data model interface.

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

The `user.service.ts` file contains the service responsible for business logic.

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

The `user.store.ts` file contains the store responsible for state management.

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
                  error: new Error('Error adding user'),
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
                  error: new Error('Error loading users'),
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
                throw new Error('Error deleting user');
              }
            }),
            catchError(() => {
              const idsRemoving = store._status().idsRemoving || [];
              patchState(store, {
                _status: {
                  ...store._status(),
                  removeLoading: false,
                  error: new Error('Error deleting user'),
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
                throw new Error('Error updating user');
              }
            }),
            catchError(() => {
              const idsUpdating = store._status().idsUpdating || [];
              patchState(store, {
                _status: {
                  ...store._status(),
                  error: new Error('Error updating user'),
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

## 📄 License

This project is under the [MIT](LICENSE) license.
