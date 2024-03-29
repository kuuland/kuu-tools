import React from 'react'
import fetch from 'isomorphic-fetch'
import _ from 'lodash'
import qs from 'qs'
import hoistStatics from 'hoist-non-react-statics'

const configs = {
  prefix: '/api',
  tokenStorageKey: 'TOKEN',
  tokenQueryKey: 'token',
  tokenHeaderKey: 'Token',
  tokenValuePrefix: undefined,
  headers: {},
  setTokenInHeaders: true,
  tokenValue: undefined,
  idKey: 'ID',
  messageHandler: undefined,
  localeContext: undefined,
  localeMessages: undefined,
  localeMessageWrapper: message => message,
  storage: window.sessionStorage,
  beforeFetch: undefined,
  afterFetch: undefined,
  onLogout: (url) => {
    if (!url.includes('/logout') && window.g_app) {
      window.g_app._store.dispatch({
        type: 'user/logout'
      })
    }
  },
  useIntl: function (prefix) {
    return {
      L: (id, defaultValue, ...values) => {
        return defaultValue
      }
    }
  }
}

export function getLocaleContext () {
  return configs.localeContext
}

/**
 * 底层请求封装
 * @param url
 * @param [opts]
 * @return {Promise}
 */
async function request (url, opts) {
  // url加工
  url = withPrefix(url)
  // 配置加工
  if (!opts) {
    opts = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      cache: 'no-cache'
    }
  }
  if (!_.isEmpty(configs.headers)) {
    _.merge(opts.headers, configs.headers)
  }
  // 设置配置令牌
  setTokenInHeaders(opts)
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

  // 执行请求
  const res = await fetch(url, opts)
  if (_.isFunction(configs.afterFetch)) {
    try {
      await configs.afterFetch(res)
    } catch (e) {
      console.error('Request failed:', e)
      return
    }
  }
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
          if (json.code === 555) {
            clearToken()
            if (_.isFunction(configs.onLogout)) {
              configs.onLogout(url, json)
            }
          } else if (_.includes([404, 500, 403], json.code)) {
            window.location.href = `/${json.code}`
          } else {
            handleResponseMessage(json)
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
    handleResponseMessage()
  }
  return success && data
}

// 定义异常处理器
function handleResponseMessage (json) {
  if (!json) {
    console.error('Network error')
  } else {
    console.error(json)
    const code = _.get(json, 'code') || _.get(json, 'errcode')
    const msg = _.get(json, 'msg') || _.get(json, 'errmsg')
    if (msg) {
      const handler = _.get(configs, 'messageHandler')
      if (_.isFunction(handler)) {
        handler(msg, code, json)
      }
    }
  }
}

function setTokenInHeaders (opts = {}) {
  let token = getToken()
  if (token && configs.setTokenInHeaders) {
    if (configs.tokenValuePrefix) {
      token = configs.tokenValuePrefix + token
    }
    _.set(opts, `headers.${configs.tokenHeaderKey}`, token)
  }
}

/**
 * 文件下载
 * @param {string} url
 * @param {string} filename
 * @param {object} opts
 */
export async function downloadFile (url, filename, opts = {}) {
  // 设置配置令牌
  setTokenInHeaders(opts)
  const res = await fetch(url, _.merge({
    cache: 'no-cache'
  }, opts))
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

/**
 * 配置函数
 * @param [opts] 配置项（可选）
 * @returns
 */
export function config (opts) {
  _.merge(configs, opts)
  return configs
}

/**
 * 清空令牌
 */
export function clearToken () {
  configs.tokenValue = undefined
  configs.storage.removeItem(configs.tokenStorageKey)
}

/**
 * 设置令牌
 * @param token 令牌
 */
export function setToken (token) {
  if (!token || ['null', 'undefined'].includes(token)) {
    clearToken()
    return
  }

  configs.tokenValue = token
  configs.storage.setItem(configs.tokenStorageKey, token)
}

/**
 * 获取令牌
 */
export function getToken () {
  // 优先取url中的令牌
  const query = qs.parse(window.location.search.substr(1))
  let token = query[configs.tokenQueryKey]
  // url中没有再从缓存取
  if (!token) {
    token = configs.tokenValue || configs.storage.getItem(configs.tokenStorageKey)
  }
  // 如果令牌是新的则更新缓存
  if (token !== configs.tokenValue) {
    setToken(token)
  }
  return token
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
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json'
    },
    cache: 'no-cache'
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
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json'
    },
    cache: 'no-cache'
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
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json'
    },
    cache: 'no-cache'
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
    if (!prefix.startsWith('http')) {
      prefix = prefix.startsWith('/') ? prefix : `/${prefix}`
    }
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
 * @param multi
 * @param unsoft
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
    return await del(url, { cond, multi, unsoft })
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
 * @param multi
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
 * @param query
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
 * @param query
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
    console.error('查询条件不能为空')
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

export function useIntl () {
  return configs.useIntl
}

/**
 * L
 * @param key
 * @param defaultMessage
 * @param formattedContext
 * @param noStyle
 * @returns {*|L.props}
 * @constructor
 */
export function L (key, defaultMessage, formattedContext, noStyle = false) {
  const template = _.get(configs.localeMessages, key, defaultMessage) || key
  let value
  if (formattedContext && !_.isEmpty(formattedContext)) {
    _.templateSettings.interpolate = /{{([\s\S]+?)}}/g
    const compiled = _.template(template)
    value = compiled(formattedContext)
    return value
  } else {
    value = template
  }
  if (_.isFunction(configs.localeMessageWrapper) && !noStyle) {
    value = configs.localeMessageWrapper(value)
  }
  return value
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
      const LocaleContext = configs.localeContext
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

export function convertLocaleCode (lang) {
  if (lang) {
    switch (lang) {
      case 'zh-Hans':
        return 'zh-CN'
      case 'zh-Hant':
        return 'zh-TW'
      case 'en':
        return 'en-US'
    }
  }
  return lang
}

export default request
