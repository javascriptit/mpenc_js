/*
 * Created: 11 Feb 2014 Guy K. Kloss <gk@mega.co.nz>
 *
 * (c) 2014-2016 by Mega Limited, Auckland, New Zealand
 *     https://mega.nz/
 *
 * This file is part of the multi-party chat encryption suite.
 *
 * This code is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License version 3
 * as published by the Free Software Foundation. See the accompanying
 * LICENSE file or <https://www.gnu.org/licenses/> if it is unavailable.
 *
 * This code is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */

define([], function() {
    "use strict";

    /**
     * @exports mpenc/version
     * @description
     * Meta-data about the mpENC library.
     */
    var ns = {};

    /** Protocol version indicator. */
    ns.PROTOCOL_VERSION = 1;

    return ns;
});
