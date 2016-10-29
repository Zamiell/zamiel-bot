# zamiel-bot

Install
-------

* `npm install`
* [Install MongoDB](https://docs.mongodb.com/manual/tutorial/install-mongodb-on-ubuntu/)
* Get all of the races: `wget --no-verbose -O all-races.json 'http://api.speedrunslive.com/pastraces?game=isaacafterbirth&pageSize=8192'`
* `vim all-races.json`
  * Remove the header so that it is a plain JSON array.
* Import them: `mongoimport --db isaac --collection races all-races.json --jsonArray`
* `cpan App::cpanminus`
* `cpanm MongoDB`
* `cpanm File::Slurp`
* `cpanm JSON`
* `crontab -e`
  * `*/5 * * * * /root/zamiel-bot/update-races/update-race-database.pl`
