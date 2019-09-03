import React from 'react'
import fetch from 'isomorphic-fetch'
import _ from 'lodash'
import qs from 'qs'
import hoistStatics from 'hoist-non-react-statics'

/**
 * 组织表单字段
 * @param L
 * @returns
 */
export function orgField (L) {
  return {
    name: 'OrgID',
    type: 'treeselect',
    label: L('kuu_common_org', 'Organization'),
    props: {
      url: '/org?range=ALL&sort=Sort&project=ID,Code,Name,Pid',
      titleKey: 'Name',
      valueKey: 'ID'
    }
  }
}

/**
 * 组织表单列
 * @param L
 * @returns
 */
export function orgColumn (L) {
  return {
    dataIndex: 'Org.Name',
    title: L('kuu_common_org', 'Organization')
  }
}

const configs = {
  prefix: '/api'
}

/**
 * 配置函数
 * @param [opts] 配置项（可选）
 * @returns 合并后的配置项
 */
export function config (opts) {
  _.merge(configs, opts)
  return configs
}

/**
 * 底层请求封装
 * @param url
 * @param body
 * @param [opts]
 * @return {Promise}
 */
async function request (url, opts) {
  // url加工
  url = withPrefix(url)
  // 配置加工
  opts = _.merge({
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    },
    cache: 'no-cache',
    credentials: 'include'
  }, opts)
  if (_.isFunction(_.get(configs, 'beforeFetch'))) {
    const args = { url, opts }
    const ret = _.get(configs, 'beforeFetch')(args)
    if (ret) {
      url = ret.url
      opts = ret.opts
    } else {
      url = args.url
      opts = args.opts
    }
  }
  const onError = _.result(opts, 'onError', null)
  delete opts.onError

  // 定义异常处理器
  const errorHandler = json => {
    if (!json) {
      console.error('Network error')
    } else {
      console.error(json)
      const msg = _.get(json, 'msg') || _.get(json, 'errmsg')
      if (_.isFunction(onError)) {
        onError(msg)
      } else if (msg) {
        const handler = _.get(configs, 'messageHandlers.error')
        if (_.isFunction(handler)) {
          handler(msg)
        }
      }
    }
  }

  // 执行请求
  const res = await fetch(url, opts)
  let data = null
  let success = false
  if (res.status >= 200 && res.status < 300) {
    let json
    try {
      json = await res.json()
      if (opts.rawData) {
        data = json
        success = true
      } else {
        if (json.code !== 0) {
          errorHandler(json)
          if (json.code === 555) {
            if (!url.includes('/logout')) {
              window.g_app._store.dispatch({
                type: 'user/logout'
              })
            }
          }
        } else {
          data = _.get(json, 'data')
          success = true
        }
      }
    } catch (e) {
      console.error(res, e)
    }
  } else {
    errorHandler()
  }
  return success && data
}

/**
 * 文件下载
 * @param {string} url
 * @param {string} filename
 * @param {object} options
 */
export async function downloadFile (url, filename, options) {
  const res = await fetch(url, _.merge({
    cache: 'no-cache',
    credentials: 'include'
  }, options))
  // 解析响应头filename
  if (!filename) {
    filename = res.headers.get('filename')
  }
  // 解析响应头content-disposition
  const contentDisposition = res.headers.get('Content-Disposition')
  if (!filename) {
    filename = _.get(new RegExp(/filename=(.*)/gi).exec(contentDisposition), '[1]')
  }
  if (!filename) {
    filename = _.get(new RegExp(/filename="(.*)"/gi).exec(contentDisposition), '[1]')
  }
  if (!filename) {
    console.error('无法正常解析文件名')
    return
  }
  filename = window.decodeURIComponent(filename)
  // 生成下载链接
  const blob = await res.blob()
  const a = window.document.createElement('a')
  a.href = window.URL.createObjectURL(blob)
  a.download = filename
  a.click()
  window.URL.revokeObjectURL(url)
}

/**
 * 常规GET请求
 * @param url
 * @param [opts]
 * @return {Promise}
 */
export function get (url, opts) {
  return request(url, opts)
}

/**
 * 常规POST请求
 * @param url
 * @param body
 * @param [opts]
 * @return {Promise}
 */
export function post (url, body, opts) {
  return request(url, _.merge({
    method: 'POST',
    body: JSON.stringify(body)
  }, opts))
}

/**
 * 常规PUT请求
 * @param url
 * @param body
 * @param [opts]
 * @return {Promise}
 */
export function put (url, body, opts) {
  return request(url, _.merge({
    method: 'PUT',
    body: JSON.stringify(body)
  }, opts))
}

/**
 * 常规DELETE请求
 * @param url
 * @param body
 * @param [opts]
 * @return {Promise}
 */
export function del (url, body, opts) {
  return request(url, _.merge({
    method: 'DELETE',
    body: JSON.stringify(body)
  }, opts))
}

/**
 * 给接口地址添加通用前缀
 * @param url
 * @returns {string}
 */
export function withPrefix (url) {
  if (url.startsWith('http')) {
    return url
  }
  let prefix = _.get(configs, 'prefix', '')
  if (url.startsWith(`${prefix}/`)) {
    return url
  }
  if (prefix) {
    prefix = prefix.startsWith('/') ? prefix : `/${prefix}`
    prefix = prefix.endsWith('/') ? prefix.substring(0, prefix.length - 1) : prefix
  }
  url = `${prefix}${url}`
  return url
}

/**
 * SDK根据名称获取最终的地址
 * @param name
 * @returns {string}
 */
export function getModelUrl (name) {
  return `/${name}`.toLowerCase()
}

/**
 * 默认新增接口
 * @param name
 * @param data
 * @returns {Promise<{}|*>}
 */
export async function create (name, data) {
  if (!name) {
    throw new Error(`name can not be empty: ${name}`)
  }
  const url = getModelUrl(name)
  if (_.isEmpty(data)) {
    return {}
  }
  try {
    const arr = Array.isArray(data) ? data : [data]
    const json = await post(url, arr)
    if (Array.isArray(data)) {
      return _.get(json, '[0]', json)
    }
    return json
  } catch (error) {
    console.error(error)
    return {}
  }
}

/**
 * 默认删除接口
 * @param name
 * @param cond
 * @returns {Promise<{}>}
 */
export async function remove (name, cond, multi = false, unsoft = false) {
  if (!name) {
    throw new Error(`name can not be empty: ${name}`)
  }
  const url = getModelUrl(name)
  if (_.isEmpty(cond)) {
    return {}
  }
  try {
    const json = await del(url, { cond, multi, unsoft })
    return json
  } catch (error) {
    console.error(error)
    return {}
  }
}

/**
 * 默认修改接口
 * @param name
 * @param cond
 * @param doc
 * @returns {Promise<{}>}
 */
export async function update (name, cond, doc, multi = false) {
  if (!name) {
    throw new Error(`name can not be empty: ${name}`)
  }
  const url = getModelUrl(name)
  if (_.isEmpty(cond) || _.isEmpty(doc)) {
    return {}
  }
  try {
    const json = await put(url, { cond, doc, multi })
    return json
  } catch (error) {
    console.error(error)
    return {}
  }
}

/**
 * 默认列表查询接口
 * @param name
 * @param query
 * @returns {Promise<{}|*>}
 */
export async function list (name, query = {}) {
  if (!name) {
    throw new Error(`name can not be empty: ${name}`)
  }
  let url = getModelUrl(name)
  if (_.isPlainObject(query.cond)) {
    query.cond = JSON.stringify(query.cond)
  } else if (!_.isString(query.cond)) {
    query.cond = {}
  }
  try {
    url = `${url}?${qs.stringify(query)}`
    const json = await get(url)
    const data = _.get(json, 'data') || json
    if (_.has(data, 'list') && !Array.isArray(data.list)) {
      data.list = []
    }
    return data
  } catch (error) {
    console.error(error)
    return {}
  }
}

/**
 * 默认单个查询接口（基于列表接口）
 * @param name
 * @param cond
 * @returns {Promise<*|{}>}
 */
export async function one (name, query = {}) {
  const json = await list(name, query)
  return _.get(json, 'list[0]') || {}
}

/**
 * 默认ID查询接口（基于列表接口）
 * @param name
 * @param idVal
 * @returns {Promise<*|{}>}
 */
export async function id (name, idVal, query = {}) {
  const idKey = _.get(configs, 'idKey', 'ID')
  const json = await list(name, _.merge({ cond: { [idKey]: idVal } }, query))
  return _.get(json, 'list[0]') || {}
}

/**
 * 查询参数
 * @param codeOrObject 参数编码或参数对象
 * @returns {Promise<{}|*>}
 */
export async function getParam (codeOrObject) {
  const obj = _.isPlainObject(codeOrObject) ? codeOrObject : { Code: codeOrObject }
  if (_.isEmpty(obj)) {
    console.error(`查询条件不能为空`)
    return {}
  }
  const json = await list('param', {
    cond: obj,
    page: 1,
    size: 1,
    sort: '-UpdatedAt'
  })
  const dict = _.get(json, 'list[0]', {})
  return dict
}

/**
 * 方法映射
 */
export const methods = {
  get,
  post,
  put,
  del,
  delete: del
}

/**
 * 解析特定格式的URL
 * @param {*} url 格式如“GET /user”
 */
export function parseAutoUrl (url) {
  const split = _.split(url, ' ')
  if (split.length === 1) {
    return {
      method: 'get',
      url: split[0]
    }
  } else {
    return {
      method: split[0].toLowerCase(),
      url: split[1]
    }
  }
}

/**
 * 支持：GET /user 格式调用
 */
export function autoFetch (url, body, opts) {
  const config = parseAutoUrl(url)
  return methods[config.method](config.url, body, opts)
}

/**
 * 解析图标字符串
 * 支持：theme:type和type两种格式
 * @param icon
 */
export function parseIcon (icon) {
  const ret = {}
  if (icon) {
    const split = icon.split(':')
    if (_.size(split) > 1) {
      ret.theme = split[0]
      ret.type = split[1]
    } else {
      ret.type = split[0]
    }
  }
  ret.type = ret.type || 'fire'
  return ret
}

/**
 * defaultMessages
 */
const defaultMessages = _.result(window, 'g_app._store.getState.user.language') || _.result(window, _.get(config(), 'localeMessagesKey', 'localeMessages'), {})

/**
 * LocaleContext
 * @type {React.Context<*>}
 */
export const LocaleContext = React.createContext(defaultMessages)

/**
 * L
 * @param key
 * @param defaultMessage
 * @param formattedContext
 * @returns {*|L.props}
 * @constructor
 */
export function L (key, defaultMessage, formattedContext) {
  const template = _.get(configs.localeMessages, key, defaultMessage) || key
  if (formattedContext && !_.isEmpty(formattedContext)) {
    _.templateSettings.interpolate = /{{([\s\S]+?)}}/g
    const compiled = _.template(template)
    const value = compiled(formattedContext)
    return value
  }
  return template
}

/**
 * withLocale
 * @param Component
 */
export function withLocale (Component) {
  const displayName = `withLocale(${Component.displayName || Component.name})`

  class C extends React.Component {
    constructor (props) {
      super(props)
      this.consumerChildren = this.consumerChildren.bind(this)
    }

    consumerChildren (localeMessages) {
      const { forwardedRef, ...rest } = this.props
      configs.localeMessages = localeMessages
      return (
        <Component
          {...rest}
          ref={forwardedRef}
          localeMessages={localeMessages}
          L={L}
        />
      )
    }

    render () {
      return (
        <LocaleContext.Consumer>
          {this.consumerChildren}
        </LocaleContext.Consumer>
      )
    }
  }

  C.displayName = displayName
  C.WrappedComponent = Component
  const LocaleComponent = hoistStatics(C, Component)
  return React.forwardRef((props, ref) => {
    return <LocaleComponent {...props} forwardedRef={ref} />
  })
}

export default request
