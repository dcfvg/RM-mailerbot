var
  fs = require('fs'),
  conf = require('./conf.json');
  Imap = require('imap'),
  _ = require('lodash'),
  mkpath = require('mkpath'),
  path = require('path'),
  gm = require('gm'),
  slug = require('slug'),
  glob = require("glob"),
  MailParser = require('mailparser').MailParser,
  nodemailer = require('nodemailer');
// connect mailbox
var transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: conf.imap.user, pass: conf.imap.password}},
  function(err, data){ console.log(err, data);
});

listenInbox();

function listenInbox(){

  var imap = new Imap(conf.imap);

  imap.on('ready', function() {
    console.log('imap ready');
    imap.openBox(conf.imap.mailbox, false, function() {
      console.log('imap opened \t', conf.imap.user, new Date());
    });
  });

  imap.on('mail', function(num) {
    imap.search(['UNSEEN'], function(err, result) {
      if (result.length) {
        var f = imap.fetch(result, {
          markSeen: conf.imap.markSeen,
          struct: true,
          bodies: ''
        });

        f.on('message', function(msg, seqNo) {
          msg.on('body', function(stream, info) {
            var buffer = '';

            stream.on('data', function(chunk) { buffer += chunk.toString('utf8') });

            stream.on('end', function() {
              var mailParser = new MailParser();

              mailParser.on('end', onEmail);
              mailParser.write(buffer);
              mailParser.end();
            });
          });
        });

        f.once('end', function() { console.log('Done fetching all messages!') });
      }
    });
  });

  imap.on('end', function(err) { console.log('end', new Date());});
  imap.on('error', function(err) { console.log('error', err, new Date());});
  imap.on('close', function(err) {console.log('close', err, new Date());});

  imap.connect();
};

// when new email comming
function onEmail(mailObject) {

  var metaData = {
    from: mailObject.from[0].address.toLowerCase(),
    subject: mailObject.subject+"",
    date: mailObject.date
  }

  var tags = metaData.subject.match(/#\S+/g);
  var timestamp = Math.round(+new Date() / 1000);

  if( !_.isUndefined(mailObject.attachments) && tags.length > 0){

    var path = __dirname+'/content/'+tags[0]+'/';

    mkpath(path, function (err) {
      if (err) throw err;

      mailObject.attachments.forEach(function(attachment){
        console.log(metaData.from, attachment.fileName);

        fs.writeFile(
          path+timestamp+cleanFilename(attachment.fileName),
          attachment.content,
          function(err){ if(err) return console.log(err);}
        );
      });
    });

  }

  var hashtag = _.sample(conf.hashtags);

  var answer = {
    from: conf.user,
    to: metaData.from,
    subject:hashtag,
    text: conf.infoMessage
  }

  transporter.sendMail(answer,function(err){ if(err) console.log(err) });


};

function cleanFilename(f){
  var ext = path.extname(f).toLowerCase();
  var name = path.basename(f, ext).toLowerCase();
  return slug(name) + ext;
}

