/**
 * mirror from https://github.com/hexojs/hexo/blob/4.2.1/lib/plugins/processor/post.js
 * 
 * - add line `categories = autoClassify(config, data, categories);`
 * 
 * - remove hexo-util `Pattern`,
 *   because hexo-util version may not match hexo/node_modules/hexo-util,
 *   and will cause a error within `new Pattern(new Pattern())`
 */
'use strict';

const { toDate, timezone, isExcludedFile, isTmpFile, isHiddenFile, isMatch } = require('./common');
const Promise = require('bluebird');
const yfm = require('hexo-front-matter');
const { extname, join } = require('path');
const { stat, listDir } = require('hexo-fs');
const { slugize, Permalink } = require('hexo-util');
const autoClassify = require('../classify');
const fs = require('fs')
var getDirName = require("path").dirname
const gpath = require('path')
const postDir = '_posts/';
const draftDir = '_drafts/';
let permalink;

const preservedKeys = {
  title: true,
  year: true,
  month: true,
  day: true,
  i_month: true,
  i_day: true,
  hash: true
};

function ConvDate(date)
{
    var original_date = new Date(date)
    var date_string = ''
    date_string += original_date.getFullYear();
    date_string += "-"+(original_date.getUTCMonth()+1);
    date_string += "-"+original_date.getDate();
    date_string += " "+original_date.getHours();
    date_string += ":"+original_date.getMinutes();
    date_string += ":"+original_date.getSeconds();
    return date_string;
}

function getRndInteger(min, max) {
  return Math.floor(Math.random() * (max - min) ) + min;
}

module.exports = ctx => {
  function processPost(file) {
    const Post = ctx.model('Post');
    const { path } = file.params;
    const doc = Post.findOne({source: file.path});
    const { config } = ctx;
    const { timezone: timezoneCfg } = config;
    // Deprecated: use_date_for_updated will be removed in future
    const updated_option = config.use_date_for_updated === true ? 'date' : config.updated_option;
    let categories, tags;

    if (file.type === 'skip' && doc) {
      return;
    }

    if (file.type === 'delete') {
      if (doc) {
        return doc.remove();
      }

      return;
    }

    return Promise.all([
      file.stat(),
      file.read()
    ]).spread((stats, content) => {
      const data = yfm(content);
      const info = parseFilename(config.new_post_name, path);
      const keys = Object.keys(info);

      data.source = file.path;
      data.raw = content;
      data.slug = info.title;

      if (file.params.published) {
        if (!Object.prototype.hasOwnProperty.call(data, 'published')) data.published = true;
      } else {
        data.published = false;
      }

      for (let i = 0, len = keys.length; i < len; i++) {
        const key = keys[i];
        if (!preservedKeys[key]) data[key] = info[key];
      }

      if (data.date) {
        data.date = toDate(data.date);
      } else if (info && info.year && (info.month || info.i_month) && (info.day || info.i_day)) {
        data.date = new Date(
          info.year,
          parseInt(info.month || info.i_month, 10) - 1,
          parseInt(info.day || info.i_day, 10)
        );
      }

      if (data.date) {
        if (timezoneCfg) data.date = timezone(data.date, timezoneCfg);
      } else {
        data.date = stats.birthtime;
      }

      data.updated = toDate(data.updated);

      if (data.updated) {
        if (timezoneCfg) data.updated = timezone(data.updated, timezoneCfg);
      } else if (updated_option === 'date') {
        data.updated = data.date;
      } else if (updated_option === 'empty') {
        delete data.updated;
      } else {
        data.updated = stats.mtime;
      }

      if (data.category && !data.categories) {
        data.categories = data.category;
        delete data.category;
      }

      if (data.tag && !data.tags) {
        data.tags = data.tag;
        delete data.tag;
      }

      categories = data.categories || [];
      tags = data.tags || [];

      if (!Array.isArray(categories)) categories = [categories];
      if (!Array.isArray(tags)) tags = [tags];

      categories = autoClassify(config, data, categories);

      if (data.photo && !data.photos) {
        data.photos = data.photo;
        delete data.photo;
      }

      if (data.photos && !Array.isArray(data.photos)) {
        data.photos = [data.photos];
      }

      if (data.link && !data.title) {
        data.title = data.link.replace(/^https?:\/\/|\/$/g, '');
      }

      if (data.permalink) {
        data.__permalink = data.permalink;
        delete data.permalink;
      }

      if((data.external && data.external.length))
      {
        var site_config = ctx.config;
        data.external.forEach(function(external_item){
          var caregories_format = ''
          if(external_item.categories && external_item.categories.length)
          {
            external_item.categories.forEach(function(cat){
              caregories_format+='\n  - '+cat;
            });
          }

          var tag_format = ''
          if(external_item.tags && external_item.tags.length)
          {
            external_item.tags.forEach(function(tag){
              tag_format+='\n  - '+tag;
            });
          }
          if (timezoneCfg && external_item.date)
          {
            external_item.date = timezone(toDate(external_item.date), timezoneCfg)
          }

          var external_date = external_item.date ? ConvDate(toDate(external_item.date)) : ConvDate(data.date)
          var author_name = external_item.author_name ? external_item.author_name : null  
          var author_site = external_item.author_site ? external_item.author_site : null  
          var author_github_id = external_item.author_github_id ? external_item.author_github_id : null  
          var author_zhihu_addr = external_item.author_zhihu_addr ? external_item.author_zhihu_addr : null  
          var author_email = external_item.author_email ? external_item.author_email : null
          var author_wechat_image = external_item.author_wechat_image ? external_item.author_wechat_image : null
          var author_avatar_image = external_item.author_avatar_image ? external_item.author_avatar_image : null
          var description_text = external_item.description ? external_item.description : ""   
          var post_id_prefix = site_config.hexo_external_post.post_id_prefix ? site_config.hexo_external_post.post_id_prefix : ``
          var post_sitemap = site_config.hexo_external_post.post_sitemap ? site_config.hexo_external_post.post_sitemap : false
          var post_sitemap_section = `sitemap: ` + post_sitemap.toString()
          var md_dir = gpath.dirname(file.source)//file.source.substring(0,file.source.length - jsGetFileName(file.source).length);
          var external_post_path = md_dir;
          var external_post_id = post_id_prefix + getRndInteger(1000000000,2000000000);
          var append_item = ''
          var append_context = ''
          if(site_config.hexo_external_post && site_config.hexo_external_post.enable)
          {
            if(!site_config.hexo_external_post.use_post_dir)
            {
              external_post_path = ctx.base_dir + "/source/"+site_config.hexo_external_post.save_dir;
            }
            external_post_id = post_id_prefix + getRndInteger(site_config.hexo_external_post.min_post_id,site_config.hexo_external_post.max_post_id);
            append_item = site_config.hexo_external_post.append_item ? site_config.hexo_external_post.append_item : ``;
            append_context = site_config.hexo_external_post.append_context ? site_config.hexo_external_post.append_context : ``;
          }
          external_post_path = gpath.normalize(external_post_path)

          var mkdirp = require("mkdirp")

          function writeFile (path, contents, cb) {
            mkdirp(getDirName(path), function (err) {
              if (err) return cb(err)
              fs.writeFile(path, contents, cb)
            })
          }

          external_post_path += external_item.title.replace(/[\\\/:*?"<>|]+/g, "") + ".md"

          var external_info = {
            source: external_post_path,  
            content: `---
title: ${external_item.title}
abbrlink: ${external_post_id}
author:
  name: ${author_name}
  site_addr: ${author_site}
  github_id: ${author_github_id}
  avatar_image: ${author_avatar_image}
  zhihu_addr: ${author_zhihu_addr}
  email: ${author_email}
  wechat_image: ${author_wechat_image}
${post_sitemap_section}
is_external: true
jump_to: ${external_item.link}
comments: false
date: ${external_date}
tag:${tag_format}
categories:${caregories_format}
${append_item}
---
${description_text}
本篇文章为外部内容，请点击链接跳转至原站点：[${external_item.title}](${external_item.link})。
${append_context}`
          }

          console.log(external_info)

          writeFile(external_post_path, external_info.content, err => {
            if (err) {
              console.error(err)
              return
            }
            //文件写入成功。
            console.log(`write file ${external_post_path}`)
          })
        });
      }

      // FIXME: Data may be inserted when reading files. Load it again to prevent
      // race condition. We have to solve this in warehouse.
      const doc = Post.findOne({source: file.path});
      if (doc) {
        return doc.replace(data);
      }
      return Post.insert(data);
    }).then(doc => Promise.all([
      doc.setCategories(categories),
      doc.setTags(tags),
      scanAssetDir(doc)
    ]));
  }

  function scanAssetDir(post) {
    if (!ctx.config.post_asset_folder) return;

    const assetDir = post.asset_dir;
    const baseDir = ctx.base_dir;
    const baseDirLength = baseDir.length;
    const PostAsset = ctx.model('PostAsset');

    return stat(assetDir).then(stats => {
      if (!stats.isDirectory()) return [];

      return listDir(assetDir);
    }).catch(err => {
      if (err && err.code === 'ENOENT') return [];
      throw err;
    }).filter(item => !isExcludedFile(item, ctx.config)).map(item => {
      const id = join(assetDir, item).substring(baseDirLength).replace(/\\/g, '/');
      const asset = PostAsset.findById(id);

      if (asset) return post.published === false ? asset.remove() : undefined; // delete if already exist
      else if (post.published === false) return undefined; // skip assets for unpulished posts and

      return PostAsset.save({
        _id: id,
        post: post._id,
        slug: item,
        modified: true
      });
    });
  }

  function processAsset(file) {
    const PostAsset = ctx.model('PostAsset');
    const Post = ctx.model('Post');
    const id = file.source.substring(ctx.base_dir.length).replace(/\\/g, '/');
    const doc = PostAsset.findById(id);

    if (file.type === 'delete') {
      if (doc) {
        return doc.remove();
      }

      return;
    }

    // TODO: Better post searching
    const post = Post.toArray().find(post => file.source.startsWith(post.asset_dir));

    if (post != null && post.published) {
      return PostAsset.save({
        _id: id,
        slug: file.source.substring(post.asset_dir.length),
        post: post._id,
        modified: file.type !== 'skip',
        renderable: file.params.renderable
      });
    }

    if (doc) {
      return doc.remove();
    }
  }

  return {
    pattern: path => {
      if (isTmpFile(path)) return;

      let result;

      if (path.startsWith(postDir)) {
        result = {
          published: true,
          path: path.substring(postDir.length)
        };
      } else if (path.startsWith(draftDir)) {
        result = {
          published: false,
          path: path.substring(draftDir.length)
        };
      }

      if (!result || isHiddenFile(result.path)) return;

      result.renderable = ctx.render.isRenderable(path) && !isMatch(path, ctx.config.skip_render);
      return result;
    },

    process: function postProcessor(file) {
      if (file.params.renderable) {
        return processPost(file);
      } else if (ctx.config.post_asset_folder) {
        return processAsset(file);
      }
    }
  };
};

function parseFilename(config, path) {
  config = config.substring(0, config.length - extname(config).length);
  path = path.substring(0, path.length - extname(path).length);

  if (!permalink || permalink.rule !== config) {
    permalink = new Permalink(config, {
      segments: {
        year: /(\d{4})/,
        month: /(\d{2})/,
        day: /(\d{2})/,
        i_month: /(\d{1,2})/,
        i_day: /(\d{1,2})/,
        hash: /([0-9a-f]{12})/
      }
    });
  }

  const data = permalink.parse(path);

  if (data) {
    return data;
  }

  return {
    title: slugize(path)
  };
}
