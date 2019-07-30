# kuu-tools

[![NPM version](https://img.shields.io/npm/v/kuu-tools.svg?style=flat)](https://npmjs.org/package/kuu-tools)
[![Build Status](https://travis-ci.org/kuuland/kuu-tools.svg?branch=master)](https://travis-ci.org/kuuland/kuu-tools)
[![NPM downloads](http://img.shields.io/npm/dm/kuu-tools.svg?style=flat)](https://npmjs.org/package/kuu-tools)
[![Dependencies](https://david-dm.org/yinfxs/kuu-tools.svg)](https://david-dm.org/yinfxs/kuu-tools)

Kuu front-end tools

## Install

```sh
npm i kuu-tools
```

## Request utils

### GET

```js
import { get } from 'kuu-tools'

const data = await get('/member/get?foo=1&bar=2')
```

### POST

```js
import { post } from 'kuu-tools'

const data = await post('/member/signup', { user: 'foo', name: 'bar' })
```

### PUT

```js
import { put } from 'kuu-tools'

const data = await put('/member/signup?foo=1&bar=2', { user: 'foo', name: 'bar' })
```

### DELETE

```js
import { del } from 'kuu-tools'

const data = await del('/member/signup?foo=1&bar=2', { user: 'foo', name: 'bar' })
```

## Model SDK

### Create

> https://github.com/kuuland/kuu#create-record

```js
import { create } from 'kuu-tools'

// create a role
const data = await create('Role', { Code: 'foo', Name: 'bar' })

// batch create roles
const data = await create('Role', [{ Code: 'foo1', Name: 'bar1' }, { Code: 'foo2', Name: 'bar2' }])
```

### Update

> https://github.com/kuuland/kuu#update-fields

```js
import { update } from 'kuu-tools'

// update a param
const data = await update('param', { ID: 5 }, { Value: 'new value', Name: 'foobar' })

// batch updates
const data = await update('param', { ID: { $in: [5, 10, 11] } }, { Value: 'new value' }, true)
```

### Delete

> https://github.com/kuuland/kuu#delete-record

```js
import { remove } from 'kuu-tools'

// delete a param
const data = await remove('param', { ID: 5 })

// batch delete
const data = await remove('param', { ID: { $in: [5, 10, 11] } }, true)

// batch and unsoft delete
const data = await remove('param', { ID: { $in: [5, 10, 11] } }, true, true)
```

### Query

> https://github.com/kuuland/kuu#query

```js
import { list, one, id } from 'kuu-tools'

// list query
const data = await list('param', { cond: { ID: { $in: [5, 10, 11] } }, page: 3, sort: '-CreatedAt' })

// query only one record
const data = await one('param', { cond: { Name: 'foo' } })

// query by id
const data = await id('param', 11)

```

## i18n

```json
{
     "hello": "你好",
     "welcome": "欢迎 {{name}}"
}
```
```js
import { withLocale } from 'kuu-tools'

class Param extends React.Component {
  render () {
    return (
      <div>
        <div>{this.props.L('hello', 'Hello')}</div>                         /* => 你好 */
        <div>{this.props.L('not_found', 'Not found')}</div>                 /* => Not found */
        <div>{this.props.L('welcome', 'Welcome Kuu', { name: 'Kuu' }}</div> /* => 欢迎 Kuu */
      </div>
    )
  }
}

export default withLocale(Param)
```

Notes:
 
1. `this.props.L` can only be used in `render`, otherwise it will not respond to language updates in real time.
1. `withLocale(Param)`
1. `withLocale(withRouter(Param))`
1. `withLocale(connect(mapStateToProps)(withRouter(Param)))`

> Message supports the [mustache](https://github.com/janl/mustache.js) syntax.