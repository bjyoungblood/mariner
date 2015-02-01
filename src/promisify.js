'use strict';

import fs from 'fs';

import Promise from 'bluebird';

Promise.promisifyAll(fs);
